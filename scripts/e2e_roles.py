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
r = submit(alice, it, 'name="startTime"', {"title": "Torre de Belém", "date": "2026-11-10", "startTime": "10:30"},
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

print("Editar e excluir atividades, reservas e custos")
def hrefs(sess, url, prefix):
    return [a["href"] for a in soup(sess.get(url)).find_all("a") if a.get("href", "").startswith(prefix)]

# atividade
item_href = hrefs(alice, f"{it}?day=2026-11-10", f"/trips/{trip_url.rsplit('/', 1)[1]}/itinerary/items/")[0]
item_url = BASE + item_href
r = alice.get(item_url)
check(r.status_code == 200 and 'value="Torre de Belém"' in r.text and "ingresso.pdf" in r.text, "tela de edição traz os dados e o anexo atual")
r = submit(alice, item_url, 'name="startTime"', {"title": "Torre de Belém (editada)", "startTime": "11:15", "date": "2026-11-11", "costEstimate": "35,50"})
check("Torre de Belém (editada)" in alice.get(f"{it}?day=2026-11-11").text, "atividade editada mudou de dia")
check("11:15" in alice.get(f"{it}?day=2026-11-11").text, "novo horário gravado")
check("Nada planejado para este dia" in alice.get(f"{it}?day=2026-11-10").text, "dia antigo não lista mais a atividade")
check("ingresso.pdf" in alice.get(f"{it}?day=2026-11-11").text, "ingresso mantido sem reenviar")
r = submit(alice, item_url, 'name="startTime"', {"date": "2027-01-01"})
check("dentro do período" in r.text, "data fora da viagem rejeitada na edição")
r = submit(alice, item_url, 'name="startTime"', {"startTime": "12:00", "endTime": "11:00", "date": "2026-11-11"})
check("antes do início" in r.text, "término antes do início rejeitado")
r = submit(alice, item_url, 'name="startTime"', {"date": "2026-11-11", "endTime": "", "removeTicket": "on"})
check("ingresso.pdf" not in alice.get(f"{it}?day=2026-11-11").text, "anexo removido ao marcar a caixa")

# reserva
bk = f"{trip_url}/bookings"
submit(alice, bk, 'name="voucher"', {"title": "Voo GRU-LIS", "type": "FLIGHT", "startAt": "2026-11-10T09:00",
       "totalPrice": "3.500,00", "currency": "BRL"},
       files={"voucher": ("eticket.pdf", io.BytesIO(b"%PDF-1.4 v1"), "application/pdf")})
tid = trip_url.rsplit("/", 1)[1]
bk_href = hrefs(alice, bk, f"/trips/{tid}/bookings/")[0]
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

print("Isolamento entre clientes")
check(bob.get(trip_url, allow_redirects=False).status_code == 404, "Bob recebe 404 na viagem da Alice")
check(bob.get(BASE + file_link, allow_redirects=False).status_code == 404, "Bob não baixa arquivo da Alice")
check("Portugal E2E" not in bob.get(f"{BASE}/").text, "home do Bob não lista a viagem da Alice")
check(requests.get(BASE + file_link).status_code == 401, "anônimo não baixa arquivo")
for label, u in (("atividade", item_url), ("reserva", bk_url), ("custo", exp_url)):
    check(bob.get(u, allow_redirects=False).status_code == 404, f"Bob não abre a edição de {label} da Alice")

print("Excluir pela tela de edição")
r = submit(alice, item_url, "Excluir esta atividade")
check("Torre de Belém (editada)" not in alice.get(f"{it}?day=2026-11-11").text, "atividade excluída")
check(alice.get(item_url, allow_redirects=False).status_code == 404, "atividade excluída some (404)")
r = submit(alice, bk_url, "Excluir esta reserva")
check("remarcado" not in alice.get(bk).text and alice.get(bk_url, allow_redirects=False).status_code == 404, "reserva excluída")
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
