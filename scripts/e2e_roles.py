"""
Teste ponta a ponta (HTTP) da estrutura Agência (MASTER) → Clientes → Viajantes.

Pré-requisitos: servidor rodando em BASE (padrão http://localhost:3100), banco vazio já
migrado e com a conta master criada por scripts/seed-master.mjs.
Variáveis: MASTER_EMAIL, MASTER_PASSWORD, BASE.

  python3 scripts/e2e_roles.py
"""
import io, os, re, sys, time
import requests
from bs4 import BeautifulSoup

BASE = os.environ.get("BASE", "http://localhost:3100")
MASTER_EMAIL = os.environ["MASTER_EMAIL"]
MASTER_PASSWORD = os.environ["MASTER_PASSWORD"]
ok_count = 0


def check(cond, msg):
    global ok_count
    if not cond:
        print(f"FALHOU: {msg}")
        sys.exit(1)
    ok_count += 1
    print(f"  ok  {msg}")


def soup(r):
    return BeautifulSoup(r.text, "html.parser")


def form_index(sess, url, needle):
    forms = soup(sess.get(url)).find_all("form")
    for i, f in enumerate(forms):
        if needle in str(f):
            return i
    raise SystemExit(f"formulário com {needle!r} não encontrado em {url}")


def submit(sess, url, needle, fields=None, files=None, follow=True):
    """Preenche e envia (como um navegador sem JS) o formulário que contém `needle`."""
    r = sess.get(url)
    form = soup(r).find_all("form")[form_index(sess, url, needle)]
    data = {}
    for inp in form.find_all(["input", "select", "textarea"]):
        name = inp.get("name")
        if not name or inp.get("type") == "file":
            continue
        if inp.name == "select":
            opt = inp.find("option", selected=True) or inp.find("option")
            data[name] = (opt.get("value", opt.text) if opt else "")
        elif inp.name == "textarea":
            data[name] = inp.text
        else:
            data[name] = inp.get("value", "")
    data.update(fields or {})
    target = requests.compat.urljoin(url, form.get("action") or url)
    multipart = {k: (None, v) for k, v in data.items()}
    for k, v in (files or {}).items():
        multipart[k] = v
    return sess.post(target, files=multipart, allow_redirects=follow, headers={"Origin": BASE})


def login(email, password):
    s = requests.Session()
    r = submit(s, f"{BASE}/login", 'name="password"', {"email": email, "password": password})
    return s, r


def T(r):
    return soup(r).get_text()


def submit_in_li(sess, url, li_text, button_text, fields=None):
    """Envia o formulário (com um botão `button_text`) que está no <li> que contém `li_text`."""
    for li in soup(sess.get(url)).find_all("li"):
        if li_text not in li.get_text():
            continue
        for form in li.find_all("form"):
            if button_text not in form.get_text():
                continue
            data = {}
            for inp in form.find_all(["input", "select"]):
                if not inp.get("name"):
                    continue
                if inp.name == "select":
                    opt = inp.find("option", selected=True) or inp.find("option")
                    data[inp["name"]] = opt.get("value", opt.text) if opt else ""
                else:
                    data[inp["name"]] = inp.get("value", "")
            data.update(fields or {})
            target = requests.compat.urljoin(url, form.get("action") or url)
            return sess.post(target, files={k: (None, v) for k, v in data.items()}, headers={"Origin": BASE})
    raise SystemExit(f"formulário '{button_text}' em '{li_text}' não encontrado em {url}")


def temp_password(r):
    m = re.search(r"<code[^>]*>([A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4})</code>", r.text)
    return m.group(1) if m else None


def client_id(master, name):
    for a in soup(master.get(f"{BASE}/agency")).find_all("a"):
        if a.get("href", "").startswith("/agency/clients/") and a.text.strip() == name and "new" not in a["href"]:
            return a["href"].rsplit("/", 1)[1]
    raise SystemExit(f"cliente {name} não encontrado na agência")


stamp = int(time.time())
A_EMAIL, B_EMAIL = f"alice{stamp}@teste.dev", f"bob{stamp}@teste.dev"

print("Cadastro público fechado e login")
check(requests.get(f"{BASE}/register", allow_redirects=False).status_code == 404, "/register não existe mais")
_, r = login(MASTER_EMAIL, "senha-errada-123")
check("E-mail ou senha incorretos" in r.text, "senha errada é rejeitada")
master, r = login(MASTER_EMAIL, MASTER_PASSWORD)
check("Clientes da agência" in r.text, "master entra e cai na dashboard da agência")
check(master.get(f"{BASE}/", allow_redirects=False).headers.get("location", "").endswith("/agency"), "master em / é levado para /agency")
check(master.get(f"{BASE}/trips/new", allow_redirects=False).headers.get("location", "").endswith("/agency"), "master não cria viagem fora da área de um cliente")

print("Agência cria clientes")
NEW = f"{BASE}/agency/clients/new"
r = submit(master, NEW, 'name="email"', {"name": "Alice", "email": A_EMAIL.upper()})
a_temp = temp_password(r)
check(a_temp is not None, f"senha temporária gerada no formato XXXX-XXXX-XXXX")
check(A_EMAIL in r.text and "não será exibida novamente" in r.text, "credenciais mostradas uma vez (e-mail normalizado)")
r = submit(master, NEW, 'name="email"', {"name": "Bob", "email": B_EMAIL})
b_temp = temp_password(r)
check(b_temp is not None, "segundo cliente criado")
r = submit(master, NEW, 'name="email"', {"name": "Alice 2", "email": A_EMAIL})
check("Já existe uma conta com esse e-mail" in r.text, "e-mail duplicado é rejeitado")
check("Aguardando 1º acesso" in master.get(f"{BASE}/agency").text, "lista mostra clientes aguardando 1º acesso")
alice_id, bob_id = client_id(master, "Alice"), client_id(master, "Bob")

print("Primeiro acesso: troca de senha obrigatória")
alice, r = login(A_EMAIL, a_temp)
check("Defina sua senha" in r.text or "/account/password" in r.url, "cliente com senha temporária é levado a trocar a senha")
check(alice.get(f"{BASE}/", allow_redirects=False).headers.get("location", "").endswith("/account/password"), "não consegue usar o sistema antes de trocar")
PW = f"{BASE}/account/password"
r = submit(alice, PW, 'name="confirm"', {"current": "errada", "next": "nova-senha-1", "confirm": "nova-senha-1"})
check("senha atual está incorreta" in r.text, "senha atual errada é rejeitada")
r = submit(alice, PW, 'name="confirm"', {"current": a_temp, "next": "curta", "confirm": "curta"})
check("ao menos 8 caracteres" in r.text, "senha curta é rejeitada")
r = submit(alice, PW, 'name="confirm"', {"current": a_temp, "next": "nova-senha-1", "confirm": "outra-coisa"})
check("confirmação não confere" in r.text, "confirmação diferente é rejeitada")
r = submit(alice, PW, 'name="confirm"', {"current": a_temp, "next": "nova-senha-1", "confirm": "nova-senha-1"})
check("Minhas viagens" in r.text, "troca concluída e cliente entra na própria área")
_, r = login(A_EMAIL, a_temp)
check("E-mail ou senha incorretos" in r.text, "senha temporária deixa de valer")
alice, r = login(A_EMAIL, "nova-senha-1")
check("Minhas viagens" in r.text, "login com a senha nova")
bob, _ = login(B_EMAIL, b_temp)
submit(bob, PW, 'name="confirm"', {"current": b_temp, "next": "senha-do-bob-1", "confirm": "senha-do-bob-1"})
bob, r = login(B_EMAIL, "senha-do-bob-1")
check("Minhas viagens" in r.text, "segundo cliente também ativou a conta")

print("Cliente não acessa a agência")
check(alice.get(f"{BASE}/agency", allow_redirects=False).status_code == 404, "cliente recebe 404 em /agency")
check(alice.get(f"{BASE}/agency/clients/{bob_id}", allow_redirects=False).status_code == 404, "cliente recebe 404 em /agency/clients/…")
check(alice.get(f"{BASE}/agency/clients/new", allow_redirects=False).status_code == 404, "cliente recebe 404 em /agency/clients/new")

print("Cliente gerencia viagem (fluxo completo)")
NT = f"{BASE}/trips/new"
r = submit(alice, NT, 'name="destination"', {
    "title": "Portugal E2E", "destination": "Lisboa", "startDate": "2026-11-10",
    "endDate": "2026-11-15", "timezone": "Europe/Lisbon", "baseCurrency": "BRL"})
check("Portugal E2E" in r.text and "/trips/" in r.url, "viagem criada")
trip_url = r.url.split("?")[0].rstrip("/")
it = f"{trip_url}/itinerary"
day10 = f"{it}/day/2026-11-10"
r = submit(alice, day10, 'name="startTime"', {"title": "Torre de Belém", "date": "2026-11-10", "startTime": "10:30"},
           files={"ticket": ("ingresso.pdf", io.BytesIO(b"%PDF-1.4 teste"), "application/pdf")})
check("Torre de Belém" in r.text and "ingresso.pdf" in r.text, "atividade com ingresso")
ex = f"{trip_url}/expenses"
r = submit(alice, ex, 'name="amount"', {"description": "Almoço", "category": "FOOD", "date": "2026-11-10",
                                          "amount": "20,00", "currency": "EUR", "exchangeRate": "6,00"},
           files={"receipt": ("nota.png", io.BytesIO(b"\x89PNG\r\n\x1a\n fake"), "image/png")})
check("Almoço" in r.text and "120,00" in r.text, "custo em EUR convertido (R$ 120,00)")
dc = f"{trip_url}/documents"
r = submit(alice, dc, 'name="file"', {"type": "PASSPORT", "title": "Passaporte Alice"},
           files={"file": ("pass.pdf", io.BytesIO(b"%PDF-1.4 pass"), "application/pdf")})
check("Passaporte Alice" in r.text, "documento enviado")
file_link = next(a["href"] for a in soup(alice.get(dc)).find_all("a") if a.get("href", "").startswith("/api/files/"))
r = alice.get(BASE + file_link)
check(r.status_code == 200 and r.content.startswith(b"%PDF"), "download do próprio cliente")

print("Roteiro resumido e dia a dia")
r = alice.get(it)
check("Dia 1" in T(r) and "Dia 6" in T(r) and "Sem título" in T(r), "resumo lista os 6 dias da viagem")
legacy = alice.get(f"{it}?day=2026-11-12")
check(legacy.url.endswith("/itinerary/day/2026-11-12"), "link antigo ?day= redireciona para o dia")
check(alice.get(f"{it}/day/2027-01-01", allow_redirects=False).status_code == 404, "dia fora da viagem dá 404")
submit(alice, it, 'name="country"', {"name": "Lisboa", "country": "Portugal"})
submit(alice, it, 'name="country"', {"name": "Porto", "country": "Portugal"})
day12 = f"{it}/day/2026-11-12"
page = soup(alice.get(day12))
city_ids = {i.parent.get_text(strip=True): i["value"] for i in page.find_all("input", {"name": "cityIds"})}
check(set(city_ids) == {"Lisboa", "Porto"}, "dia oferece as cidades cadastradas")
# o harness envia um único valor por campo; para marcar 2 cidades, montamos o multipart na mão
form = [f for f in page.find_all("form") if f.find("input", {"name": "cityIds"})][0]
action_fields = {i["name"]: i.get("value", "") for i in form.find_all("input", type="hidden") if i.get("name")}
multi = [(k, (None, v)) for k, v in action_fields.items()]
multi += [("title", (None, "Lisboa → Porto")), ("summary", (None, "Trem de manhã e tarde livre no Porto.")),
          ("cityIds", (None, city_ids["Lisboa"])), ("cityIds", (None, city_ids["Porto"]))]
r = alice.post(requests.compat.urljoin(day12, form["action"]), files=multi, headers={"Origin": BASE})
check("Lisboa → Porto" in T(r) and "📍 Lisboa" in T(r) and "📍 Porto" in T(r), "resumo do dia salvo com duas cidades")
ov = T(alice.get(it))
check("Lisboa → Porto" in ov and "Trem de manhã" in ov and "📍 Porto" in ov, "resumo mostra título, descrição e cidades do dia")
r = submit(alice, day12, 'name="cityIds"', {"title": "", "summary": "", "cityIds": ""})
check("Lisboa → Porto" not in alice.get(it).text, "limpar o resumo remove o dia")
r = alice.get(f"{it}/day/2026-11-11")
check("Dia anterior" in T(r) and "Próximo dia" in T(r), "navegação entre dias")
submit(alice, day12, 'name="cityIds"', {"title": "Passeio", "summary": "x"})

print("Editar viagem")
ed = f"{trip_url}/edit"
r = alice.get(ed)
check(r.status_code == 200 and 'value="Portugal E2E"' in r.text, "tela de edição da viagem")
r = submit(alice, ed, 'name="startDate"', {"endDate": "2026-11-11"})
check("Não dá para alterar as datas" in r.text, "encurtar a viagem com atividades fora é bloqueado")
r = submit(alice, ed, 'name="startDate"', {"startDate": "2026-11-12"})
check("Não dá para alterar as datas" in r.text, "adiar a ida com atividade no primeiro dia é bloqueado")
r = submit(alice, ed, 'name="startDate"', {"endDate": "2026-11-01"})
check("antes da ida" in r.text, "volta antes da ida rejeitada")
r = submit(alice, ed, 'name="startDate"', {"baseCurrency": "USD"})
check("moeda base" in r.text, "trocar a moeda base com custos é bloqueado")
r = submit(alice, ed, 'name="startDate"', {"title": "Portugal E2E editada", "destination": "Lisboa e Porto", "endDate": "2026-11-16", "notes": "nova obs"})
check("Portugal E2E editada" in r.text and "Lisboa e Porto" in r.text, "nome, destino e volta alterados")
check(len(soup(alice.get(it)).find_all("a", href=re.compile(r"/itinerary/day/"))) == 7, "roteiro ganhou o 7º dia")
check(len(soup(alice.get(trip_url)).find_all("a", string="Editar viagem")) == 1, "dono vê o link Editar viagem")
submit(alice, f"{it}/day/2026-11-16", 'name="cityIds"', {"title": "Extra", "cityIds": ""})
r = submit(alice, ed, 'name="startDate"', {"endDate": "2026-11-15"})
check("Não dá para alterar" in r.text and "resumo" in r.text, "resumo de dia fora do novo período bloqueia")
submit(alice, f"{it}/day/2026-11-16", 'name="cityIds"', {"title": "", "summary": "", "cityIds": ""})
r = submit(alice, ed, 'name="startDate"', {"endDate": "2026-11-15"})
check("Portugal E2E editada" in r.text and len(soup(alice.get(it)).find_all("a", href=re.compile(r"/itinerary/day/"))) == 6, "sem nada fora, voltar para 15/11 funciona")

print("Editar e excluir atividades, reservas e custos")
def hrefs(sess, url, prefix):
    return [a["href"] for a in soup(sess.get(url)).find_all("a") if a.get("href", "").startswith(prefix)]

# atividade
item_href = hrefs(alice, f"{it}/day/2026-11-10", f"/trips/{trip_url.rsplit('/', 1)[1]}/itinerary/items/")[0]
item_url = BASE + item_href
r = alice.get(item_url)
check(r.status_code == 200 and 'value="Torre de Belém"' in r.text and "ingresso.pdf" in r.text, "tela de edição traz os dados e o anexo atual")
r = submit(alice, item_url, 'name="startTime"', {"title": "Torre de Belém (editada)", "startTime": "11:15", "date": "2026-11-11", "costEstimate": "35,50"})
check("Torre de Belém (editada)" in alice.get(f"{it}/day/2026-11-11").text, "atividade editada mudou de dia")
check("11:15" in alice.get(f"{it}/day/2026-11-11").text, "novo horário gravado")
check("Nada planejado para este dia" in alice.get(f"{it}/day/2026-11-10").text, "dia antigo não lista mais a atividade")
check("ingresso.pdf" in alice.get(f"{it}/day/2026-11-11").text, "ingresso mantido sem reenviar")
r = submit(alice, item_url, 'name="startTime"', {"date": "2027-01-01"})
check("dentro do período" in r.text, "data fora da viagem rejeitada na edição")
r = submit(alice, item_url, 'name="startTime"', {"startTime": "12:00", "endTime": "11:00", "date": "2026-11-11"})
check("antes do início" in r.text, "término antes do início rejeitado")
r = submit(alice, item_url, 'name="startTime"', {"date": "2026-11-11", "endTime": "", "removeTicket": "on"})
check("ingresso.pdf" not in alice.get(f"{it}/day/2026-11-11").text, "anexo removido ao marcar a caixa")

# reserva
bk = f"{trip_url}/transports"
submit(alice, bk, 'name="voucher"', {"title": "Voo GRU-LIS", "type": "FLIGHT", "startAt": "2026-11-10T09:00",
       "totalPrice": "3.500,00", "currency": "BRL"},
       files={"voucher": ("eticket.pdf", io.BytesIO(b"%PDF-1.4 v1"), "application/pdf")})
tid = trip_url.rsplit("/", 1)[1]
bk_href = hrefs(alice, bk, f"/trips/{tid}/transports/")[0]
bk_url = BASE + bk_href
r = alice.get(bk_url)
check('value="Voo GRU-LIS"' in r.text and 'value="3500,00"' in r.text and 'value="2026-11-10T09:00"' in r.text, "reserva carrega valores (preço e data/hora)")
r = submit(alice, bk_url, 'name="voucher"', {"title": "Voo GRU-LIS (remarcado)", "startAt": "2026-11-10T21:40", "confirmationCode": "ABC123"},
           files={"voucher": ("eticket2.pdf", io.BytesIO(b"%PDF-1.4 v2"), "application/pdf")})
lst = alice.get(bk).text
check("remarcado" in lst and "ABC123" in lst and "21:40" in lst, "reserva editada")
check("eticket2.pdf" in lst and "eticket.pdf" not in lst.replace("eticket2.pdf", ""), "voucher substituído por outro arquivo")
r = submit(alice, bk_url, 'name="voucher"', {"totalPrice": "", "removeVoucher": "on"})
lst = alice.get(bk).text
check("eticket2.pdf" not in lst and "R$" not in lst.split("remarcado")[1][:400], "sem valor a moeda é descartada e voucher removido")

# custo
exp_href = hrefs(alice, ex, f"/trips/{tid}/expenses/")[0]
exp_url = BASE + exp_href
r = alice.get(exp_url)
check('value="Almoço"' in r.text and 'value="20,00"' in r.text and 'value="6"' in r.text, "custo carrega valores")
r = submit(alice, exp_url, 'name="amount"', {"description": "Almoço (editado)", "amount": "25,00", "category": "FOOD", "currency": "EUR", "exchangeRate": "6,00"})
r = alice.get(ex)
check("Almoço (editado)" in r.text and "150,00" in r.text, "custo editado e total reconvertido (25 EUR × 6 = R$ 150,00)")
check("recibo" in r.text, "recibo mantido")
r = submit(alice, exp_url, 'name="amount"', {"currency": "BRL", "exchangeRate": "9,99"})
r = alice.get(ex)
check("25,00" in r.text and "≈" not in r.text, "mudar para a moeda base zera a cotação")
r = submit(alice, exp_url, 'name="amount"', {"amount": "0"})
check("valor válido" in r.text, "valor zero rejeitado")
r = submit(alice, exp_url, 'name="amount"', {"removeReceipt": "on", "amount": "25,00"})
check("recibo" not in alice.get(ex).text.split("Almoço (editado)")[1][:600], "recibo removido")

print("Cidades, abas, hospedagens e reserva na atividade")
check(soup(alice.get(it)).find("input", {"name": "arrival"}) is None, "cadastro de cidade não pede mais datas")
nav = [a.get_text(strip=True) for a in soup(alice.get(trip_url)).find_all("a", href=re.compile(rf"/trips/{tid}/(transports|lodgings|bookings)$"))]
check("Transportes" in nav and "Hospedagens" in nav and "Reservas" not in nav, "abas Transportes e Hospedagens")

# reserva dentro da atividade (a atividade está no dia 11/11)
d11 = f"{it}/day/2026-11-11"
page = soup(alice.get(d11))
check(any(a.get_text(strip=True) == "sem reserva" for a in page.find_all("a")), "atividade sem reserva mostra o aviso")
r = submit(alice, item_url, 'name="reservationCode"', {"reservationProvider": "GetYourGuide", "reservationCode": "GYG42",
           "reservationPrice": "45,90", "reservationCurrency": "EUR"},
           files={"reservationVoucher": ("voucher-gyg.pdf", io.BytesIO(b"%PDF-1.4 gyg"), "application/pdf")})
page = soup(alice.get(d11))
badge = [a for a in page.find_all("a") if a.get_text(strip=True) == "reservado"]
check(len(badge) == 1 and badge[0]["href"].endswith("#reserva") and "/itinerary/items/" in badge[0]["href"], "aviso reservado com link para detalhes/edição")
check("GYG42" in T(alice.get(d11)) and "GetYourGuide" in T(alice.get(d11)), "agenda mostra fornecedor e código da reserva")
r = alice.get(item_url)
check('value="GYG42"' in r.text and 'value="45,90"' in r.text and "voucher-gyg.pdf" in r.text and 'id="reserva"' in r.text, "edição mostra os dados e o voucher da reserva")
r = submit(alice, item_url, 'name="reservationCode"', {"reservationPrice": "abc"})
check("Valor da reserva inválido" in T(r), "valor de reserva inválido rejeitado")
r = submit(alice, item_url, 'name="reservationCode"', {"reservationProvider": "", "reservationCode": "", "reservationPrice": "",
           "reservationDetails": "", "removeReservationVoucher": "on"})
page = soup(alice.get(d11))
check(any(a.get_text(strip=True) == "sem reserva" for a in page.find_all("a")) and not any(a.get_text(strip=True) == "reservado" for a in page.find_all("a")), "limpando os campos volta para sem reserva")

# transportes não aceitam mais Hotel
r = submit(alice, bk, 'name="voucher"', {"title": "Hotel velho", "type": "HOTEL"})
check("Tipo de transporte inválido" in T(r), "Hotel não é mais tipo de transporte")

# hospedagens
lg = f"{trip_url}/lodgings"
check(alice.get(lg).status_code == 200 and "Nenhuma hospedagem" in T(alice.get(lg)), "aba Hospedagens vazia")
r = submit(alice, lg, 'name="checkInDate"', {"name": "Hotel Avenida", "type": "HOTEL", "checkInDate": "2026-11-10", "checkInTime": "15:00",
           "checkOutDate": "2026-11-12", "checkOutTime": "11:00", "totalPrice": "1.200,00", "currency": "EUR", "confirmationCode": "H123",
           "provider": "Booking", "address": "Av. da Liberdade 1"},
           files={"voucher": ("hotel.pdf", io.BytesIO(b"%PDF-1.4 h"), "application/pdf")})
txt = T(r)
check("Hotel Avenida" in txt and "2 noites" in txt and "H123" in txt and "hotel.pdf" in txt, "hospedagem cadastrada com noites, código e voucher")
r = submit(alice, lg, 'name="checkInDate"', {"name": "Errada", "checkInDate": "2026-11-12", "checkOutDate": "2026-11-10"})
check("check-out não pode ser antes" in T(r), "check-out antes do check-in rejeitado")
check("Check-in: Hotel Avenida" in T(alice.get(f"{it}/day/2026-11-10")), "check-in aparece na agenda do dia")
check("Check-out: Hotel Avenida" in T(alice.get(f"{it}/day/2026-11-12")), "check-out aparece na agenda do dia")
lg_href = hrefs(alice, lg, f"/trips/{tid}/lodgings/")[0]
lg_url = BASE + lg_href
check('value="Hotel Avenida"' in alice.get(lg_url).text and 'value="1200,00"' in alice.get(lg_url).text, "edição de hospedagem carrega valores")
r = submit(alice, lg_url, 'name="checkInDate"', {"name": "Hotel Avenida Palace", "checkOutDate": "2026-11-13", "removeVoucher": "on"})
txt = T(r)
check("Hotel Avenida Palace" in txt and "3 noites" in txt and "hotel.pdf" not in txt, "hospedagem editada (nome, noites, voucher removido)")
check(bob.get(lg_url, allow_redirects=False).status_code == 404, "Bob não abre hospedagem da Alice")
r = submit(alice, lg_url, "Excluir esta hospedagem")
check("Hotel Avenida" not in T(alice.get(lg)) and alice.get(lg_url, allow_redirects=False).status_code == 404, "hospedagem excluída")

print("Viajantes")
TV = f"{BASE}/travelers"
r = submit(alice, TV, 'name="documentNumber"', {"name": "Maria Silva", "email": "maria@teste.dev", "birthDate": "1990-05-20", "phone": "+5511999998888"})
check("Maria Silva" in r.text, "viajante cadastrado")
r = submit(alice, TV, 'name="documentNumber"', {"name": "X", "email": "nao-e-email"})
check("Informe o nome" in r.text or "inválido" in r.text, "dados inválidos de viajante rejeitados")
submit(alice, TV, 'name="documentNumber"', {"name": "Carlos Souza"})
alice_hrefs = [a["href"] for a in soup(alice.get(TV)).find_all("a") if a.get("href", "").startswith("/travelers/")]
check(len(alice_hrefs) == 2, "dois viajantes na lista")
# ordem alfabética: Carlos Souza, depois Maria Silva
carlos_href = alice_hrefs[0]
carlos_url = BASE + carlos_href
check("Carlos Souza" in alice.get(carlos_url).text, "o primeiro da lista é o Carlos")
submit(alice, carlos_url, 'name="documentNumber"', {"documentNumber": "AB123456"})
check('value="AB123456"' in alice.get(carlos_url).text, "edição de viajante persistida")

# vínculo à viagem
r = submit(alice, trip_url, 'name="travelerId"', {})  # sem escolher: select vazio é ignorado
carlos_id = carlos_href.rsplit("/", 1)[1]
r = submit(alice, trip_url, 'name="travelerId"', {"travelerId": carlos_id})
check("Viajantes (1)" in soup(r).get_text() and "Carlos Souza" in r.text, "viajante incluído na viagem")

# Bob: viajante próprio e isolamento
submit(bob, TV, 'name="documentNumber"', {"name": "Joao do Bob"})
bob_trav_href = next(a["href"] for a in soup(bob.get(TV)).find_all("a") if a.get("href", "").startswith("/travelers/"))
bob_trav_id = bob_trav_href.rsplit("/", 1)[1]
check("Joao do Bob" not in alice.get(TV).text, "viajantes de um cliente não aparecem para outro")
check(alice.get(BASE + bob_trav_href, allow_redirects=False).status_code == 404, "cliente não abre viajante de outro (404)")
r = submit(alice, trip_url, 'name="travelerId"', {"travelerId": bob_trav_id})
check("Joao do Bob" not in r.text, "não dá para incluir viajante de outro cliente na própria viagem")

print("Excluir reserva e links na agenda do dia")
d11 = f"{it}/day/2026-11-11"
submit(alice, item_url, 'name="reservationCode"', {"reservationProvider": "Museu", "reservationCode": "MUS9", "reservationPrice": "10,00", "reservationCurrency": "EUR"})
page = soup(alice.get(d11))
check(any(a.get_text(strip=True) == "reservado" for a in page.find_all("a")), "reserva cadastrada para testar a exclusão")
r = submit(alice, d11, "excluir reserva")
page = soup(r)
check(any(a.get_text(strip=True) == "sem reserva" for a in page.find_all("a")) and "MUS9" not in T(r), "excluir reserva pela agenda do dia")
check("Torre de Belém (editada)" in T(r), "a atividade continua depois de excluir a reserva")
submit(alice, item_url, 'name="reservationCode"', {"reservationProvider": "Museu", "reservationCode": "MUS9"})
r = submit(alice, item_url, "Excluir só a reserva")
check('value="MUS9"' not in alice.get(item_url).text and "Torre de Belém (editada)" in alice.get(d11).text, "excluir reserva pela tela de edição")
r = alice.get(item_url)
check("Excluir só a reserva" not in T(r), "sem reserva, a opção de excluir some")

d10 = f"{it}/day/2026-11-10"
submit(alice, lg, 'name="checkInDate"', {"name": "Pousada Teste", "checkInDate": "2026-11-10", "checkOutDate": "2026-11-11", "confirmationCode": "P77"},
       files={"voucher": ("pousada.pdf", io.BytesIO(b"%PDF-1.4 pousada"), "application/pdf")})
page = soup(alice.get(d10))
tr_link = [a for a in page.find_all("a") if a.get_text(strip=True) == "transporte"]
lg_link = [a for a in page.find_all("a") if a.get_text(strip=True) == "hospedagem"]
check(tr_link and "/transports/" in tr_link[0]["href"], "transporte na agenda tem link para detalhes/edição")
check(lg_link and "/lodgings/" in lg_link[0]["href"], "hospedagem na agenda tem link para detalhes/edição")
check(alice.get(BASE + lg_link[0]["href"]).status_code == 200, "o link da hospedagem abre a edição")

print("Painel do viajante")
maria_href = alice_hrefs[1]
maria_url = BASE + maria_href
maria_id = maria_href.rsplit("/", 1)[1]
r = alice.get(BASE + alice_hrefs[0])
check("Cadastre o e-mail do viajante" in T(r), "viajante sem e-mail não gera acesso")
submit(alice, trip_url, 'name="travelerId"', {"travelerId": maria_id})
r = submit(alice, maria_url, "Gerar acesso")
m_temp = temp_password(r)
check(m_temp is not None, "acesso do viajante gerado com senha temporária")
check("Status:" in T(alice.get(maria_url)) and "ativo" in T(alice.get(maria_url)), "ficha mostra acesso ativo")
mar, r = login("maria@teste.dev", m_temp)
check("/account/password" in r.url or "Defina sua senha" in r.text, "viajante troca a senha no primeiro acesso")
r = submit(mar, PW, 'name="confirm"', {"current": m_temp, "next": "senha-da-maria-1", "confirm": "senha-da-maria-1"})
check("somente para consulta" in T(r), "viajante cai no painel dele")
mar, r = login("maria@teste.dev", "senha-da-maria-1")
check("somente para consulta" in T(r) and "Portugal E2E editada" in T(r), "painel lista a viagem em que ela está")
check(mar.get(f"{BASE}/", allow_redirects=False).headers.get("location", "").endswith("/traveler"), "home do viajante vai para /traveler")
panel = f"{BASE}/traveler/trips/{tid}"
r = mar.get(panel)
txt = T(r)
check(r.status_code == 200 and "Roteiro resumido" in txt and "Transportes" in txt and "Hospedagens" in txt and "Documentos" in txt, "dashboard do viajante tem roteiro, transportes, hospedagens e documentos")
check("R$" not in txt and "€" not in txt and "Custos" not in txt, "painel não mostra custos nem valores")
check("Passaporte" not in txt, "documentos só do dono não aparecem")
day_link = [a["href"] for a in soup(r).find_all("a") if "/day/" in a.get("href", "")]
check(len(day_link) >= 6, "dias do roteiro resumido têm link para a agenda")
r = mar.get(BASE + day_link[0])
check(r.status_code == 200 and "Agenda do dia" in T(r), "agenda do dia no painel do viajante")
check("Pousada Teste" in T(mar.get(f"{panel}/day/2026-11-10")), "agenda do viajante mostra a hospedagem")
check("Editar" not in T(mar.get(f"{panel}/day/2026-11-11")) and "Remover" not in T(mar.get(f"{panel}/day/2026-11-11")), "painel é somente leitura (sem editar/remover)")
for path in (f"/trips/{tid}", f"/trips/{tid}/expenses", f"/trips/{tid}/itinerary", "/travelers", "/agency"):
    check(mar.get(BASE + path, allow_redirects=False).status_code in (404, 307, 303), f"viajante não acessa {path}")
check(mar.get(f"{BASE}/trips/new", allow_redirects=False).status_code in (303, 307, 404), "viajante não cria viagem")

# documentos: dono / grupo / viajante
dc = f"{trip_url}/documents"
pdf = lambda n: {"file": (n, io.BytesIO(b"%PDF-1.4 " + n.encode()), "application/pdf")}
submit(alice, dc, 'name="file"', {"type": "INSURANCE", "title": "Seguro do grupo", "visibility": "GROUP"}, files=pdf("seguro.pdf"))
submit(alice, dc, 'name="file"', {"type": "PASSPORT", "title": "Passaporte Maria", "visibility": f"TRAVELER:{maria_id}"}, files=pdf("pass-maria.pdf"))
submit(alice, dc, 'name="file"', {"type": "PASSPORT", "title": "Passaporte Carlos", "visibility": f"TRAVELER:{carlos_id}"}, files=pdf("pass-carlos.pdf"))
r = submit(alice, dc, 'name="file"', {"type": "OTHER", "title": "Fora do grupo", "visibility": "TRAVELER:inexistente"}, files=pdf("x.pdf"))
check("não faz parte do grupo" in T(r), "documento para viajante fora do grupo é rejeitado")
def doc_ids(sess):
    out = {}
    for a in soup(sess.get(dc)).find_all("a", href=re.compile(r"^/api/files/")):
        out[a.get_text(strip=True)] = a["href"]
    return out
ids = doc_ids(alice)
check({"Seguro do grupo", "Passaporte Maria", "Passaporte Carlos", "Passaporte Alice"} <= set(ids), "dono vê todos os documentos")
txt = T(mar.get(panel))
check("Seguro do grupo" in txt and "Passaporte Maria" in txt, "viajante vê o documento do grupo e o dele")
check("Passaporte Carlos" not in txt and "Passaporte Alice" not in txt, "viajante não vê o de outro viajante nem o do dono")
check(mar.get(BASE + ids["Seguro do grupo"]).status_code == 200, "viajante baixa documento do grupo")
check(mar.get(BASE + ids["Passaporte Maria"]).status_code == 200, "viajante baixa o próprio documento")
check(mar.get(BASE + ids["Passaporte Carlos"], allow_redirects=False).status_code == 404, "viajante não baixa o de outro viajante")
check(mar.get(BASE + ids["Passaporte Alice"], allow_redirects=False).status_code == 404, "viajante não baixa documento só do dono")
rec = [h for k, h in ids.items() if k.startswith("Recibo")]
check(rec and alice.get(BASE + rec[0]).status_code in (200, 404), "recibo existe na central do dono")
check(mar.get(BASE + rec[0], allow_redirects=False).status_code == 404, "viajante não baixa recibo")
lodg_doc = [a["href"] for a in soup(alice.get(lg)).find_all("a", href=re.compile(r"^/api/files/")) if "pousada.pdf" in a.get_text()][0]
check(mar.get(BASE + lodg_doc).status_code == 200, "viajante baixa voucher anexado à hospedagem")
r = submit_in_li(alice, dc, "Passaporte Alice", "Salvar", {"visibility": f"TRAVELER:{maria_id}"})
check(mar.get(BASE + ids["Passaporte Alice"]).status_code == 200 and "Passaporte Alice" in T(mar.get(panel)), "dono muda a visibilidade e o viajante passa a ver")
r = submit_in_li(alice, dc, "Passaporte Alice", "Salvar", {"visibility": "OWNER"})
check(mar.get(BASE + ids["Passaporte Alice"], allow_redirects=False).status_code == 404, "voltando para só o dono, o acesso some")
check(requests.get(BASE + ids["Seguro do grupo"]).status_code == 401, "anônimo não baixa documento do grupo")
check(bob.get(BASE + ids["Seguro do grupo"], allow_redirects=False).status_code == 404, "outro cliente não baixa documento do grupo")
check(bob.get(panel, allow_redirects=False).status_code == 404, "outro cliente não abre o painel")

# dono visualiza o painel
r = alice.get(panel)
check(r.status_code == 200 and "como o viajante o enxerga" in T(r) and "Passaporte Alice" in T(r), "dono abre o painel do viajante (vê tudo)")
check(len(soup(alice.get(trip_url)).find_all("a", string=re.compile("painel do viajante"))) == 1, "link para o painel na viagem")

# tirar do grupo corta o acesso
submit_in_li(alice, trip_url, "Maria Silva", "Remover")
check(mar.get(panel, allow_redirects=False).status_code == 404, "fora do grupo, o viajante perde o painel")
check(mar.get(BASE + ids["Seguro do grupo"], allow_redirects=False).status_code == 404, "fora do grupo, perde os arquivos")
submit(alice, trip_url, 'name="travelerId"', {"travelerId": maria_id})
check(mar.get(panel).status_code == 200, "de volta ao grupo, o acesso volta")

# desativar / redefinir / excluir
r = submit(alice, maria_url, "Desativar acesso")
check("desativado" in T(alice.get(maria_url)), "acesso desativado")
check("/login" in mar.get(panel).url, "sessão do viajante desativado cai na hora")
_, r = login("maria@teste.dev", "senha-da-maria-1")
check("desativada" in T(r), "viajante desativado não entra")
submit(alice, maria_url, "Reativar acesso")
_, r = login("maria@teste.dev", "senha-da-maria-1")
check("somente para consulta" in T(r), "acesso reativado")
r = submit(alice, maria_url, "Gerar nova senha temporária")
m_temp2 = temp_password(r)
check(m_temp2 and m_temp2 != m_temp, "nova senha temporária gerada")
_, r = login("maria@teste.dev", "senha-da-maria-1")
check("incorretos" in T(r), "senha antiga deixa de valer")
r = submit(alice, maria_url, 'name="documentNumber"', {"name": "Maria Silva Souza", "email": "outro@teste.dev"})
check('value="maria@teste.dev"' in alice.get(maria_url).text, "e-mail com acesso gerado não muda")
r = submit(alice, maria_url, "Excluir este viajante")
_, r = login("maria@teste.dev", m_temp2)
check("incorretos" in T(r), "excluir o viajante apaga o login dele")

print("Isolamento entre clientes")
check(bob.get(trip_url, allow_redirects=False).status_code == 404, "Bob recebe 404 na viagem da Alice")
check(bob.get(BASE + file_link, allow_redirects=False).status_code == 404, "Bob não baixa arquivo da Alice")
check("Portugal E2E" not in bob.get(f"{BASE}/").text, "home do Bob não lista a viagem da Alice")
check(requests.get(BASE + file_link).status_code == 401, "anônimo não baixa arquivo")
for label, u in (("atividade", item_url), ("transporte", bk_url), ("custo", exp_url)):
    check(bob.get(u, allow_redirects=False).status_code == 404, f"Bob não abre a edição de {label} da Alice")

print("Excluir pela tela de edição")
r = submit(alice, item_url, "Excluir esta atividade")
check("Torre de Belém (editada)" not in alice.get(f"{it}/day/2026-11-11").text, "atividade excluída")
check(alice.get(item_url, allow_redirects=False).status_code == 404, "atividade excluída some (404)")
r = submit(alice, bk_url, "Excluir este transporte")
check("remarcado" not in alice.get(bk).text and alice.get(bk_url, allow_redirects=False).status_code == 404, "transporte excluído")
r = submit(alice, exp_url, "Excluir este lançamento")
check("Almoço (editado)" not in alice.get(ex).text and alice.get(exp_url, allow_redirects=False).status_code == 404, "custo excluído")

print("Agência acessa a área do cliente")
check(master.get(trip_url, allow_redirects=False).status_code == 404, "master, sem entrar na área do cliente, não vê a viagem")
detail = f"{BASE}/agency/clients/{alice_id}"
check("Portugal E2E" in master.get(detail).text and "Carlos Souza" in master.get(detail).text, "ficha do cliente lista viagens e viajantes")
r = submit(master, detail, "Acessar área do cliente")
check("Portugal E2E" in r.text, "master vê a lista de viagens da Alice")
check("Você está na área do cliente" in r.text and "Voltar à agência" in r.text, "banner de personificação visível")
r = master.get(trip_url)
check(r.status_code == 200 and "Portugal E2E" in r.text, "master abre a viagem do cliente")
r = master.get(BASE + file_link)
check(r.status_code == 200 and r.content.startswith(b"%PDF"), "master baixa o arquivo do cliente")
check(master.get(f"{BASE}/agency", allow_redirects=False).status_code == 200, "master continua com acesso à agência durante a personificação")
r = submit(master, f"{BASE}/travelers", 'name="documentNumber"', {"name": "Viajante criado pela agência"})
check("Viajante criado pela agência" in r.text, "master age como o cliente (cria viajante)")
r = submit(master, f"{BASE}/", "Voltar à agência")
check("Clientes da agência" in r.text and "Você está na área do cliente" not in r.text, "voltar à agência encerra a personificação")
check(master.get(trip_url, allow_redirects=False).status_code == 404, "depois de voltar, a viagem some de novo")
check("Viajante criado pela agência" in alice.get(TV).text, "alteração feita pela agência aparece para a Alice")

print("Desativar, reativar e redefinir senha")
bdetail = f"{BASE}/agency/clients/{bob_id}"
submit(master, bdetail, "Desativar acesso")
check("Desativado" in master.get(bdetail).text, "cliente aparece como desativado")
check(bob.get(f"{BASE}/", allow_redirects=False).status_code in (307, 308), "sessão ativa do cliente desativado cai na hora")
_, r = login(B_EMAIL, "senha-do-bob-1")
check("desativada" in r.text, "cliente desativado não consegue entrar")
submit(master, bdetail, "Reativar acesso")
bob, r = login(B_EMAIL, "senha-do-bob-1")
check("Minhas viagens" in r.text, "reativado, o cliente volta a entrar")
r = submit(master, bdetail, "Gerar nova senha temporária")
new_temp = temp_password(r)
check(new_temp is not None, "nova senha temporária gerada")
_, r = login(B_EMAIL, "senha-do-bob-1")
check("E-mail ou senha incorretos" in r.text, "senha antiga deixa de valer após a redefinição")
bob2, r = login(B_EMAIL, new_temp)
check("/account/password" in r.url or "Defina sua senha" in r.text, "nova temporária também obriga a trocar")

print("Edição de cliente")
r = submit(master, bdetail, 'name="email"', {"name": "Bob Editado", "email": A_EMAIL})
check("Já existe uma conta com esse e-mail" in r.text, "não permite e-mail já usado")
r = submit(master, bdetail, 'name="email"', {"name": "Bob Editado", "email": B_EMAIL})
check("Bob Editado" in r.text, "nome do cliente atualizado")

print("Limite de tentativas de login")
ghost = f"ghost{stamp}@teste.dev"
for _ in range(8):
    login(ghost, "qualquer-senha")
_, r = login(ghost, "qualquer-senha")
check("Muitas tentativas" in r.text, "após 8 falhas o login é bloqueado temporariamente")

print("Logout")
r = submit(alice, f"{BASE}/", "Sair")
check("Entrar" in r.text, "logout volta para o login")
check(alice.get(trip_url, allow_redirects=False).status_code in (307, 308), "após logout a viagem exige login")

print(f"\nTudo certo — {ok_count} verificações passaram.")
