"""
Teste ponta a ponta via HTTP (formulários enviados como um navegador sem JS).
Requer o servidor rodando em BASE (padrão http://localhost:3100).
  python3 scripts/e2e.py
"""
import io, os, re, sys, time
import requests
from bs4 import BeautifulSoup

BASE = os.environ.get("BASE", "http://localhost:3100")
ok_count = 0


def check(cond, msg):
    global ok_count
    if not cond:
        print(f"FALHOU: {msg}")
        sys.exit(1)
    ok_count += 1
    print(f"  ok  {msg}")


def submit(sess, page_url, form_index, fields=None, files=None):
    """Lê a página, pega o formulário N e envia com os campos preenchidos."""
    r = sess.get(page_url)
    soup = BeautifulSoup(r.text, "html.parser")
    form = soup.find_all("form")[form_index]
    data = {}
    for inp in form.find_all(["input", "select", "textarea"]):
        name = inp.get("name")
        if not name or inp.get("type") == "file":
            continue
        if inp.name == "select":
            opt = inp.find("option", selected=True) or inp.find("option")
            data[name] = opt.get("value", opt.text) if opt else ""
        elif inp.name == "textarea":
            data[name] = inp.text
        else:
            data[name] = inp.get("value", "")
    data.update(fields or {})
    action = form.get("action") or page_url
    url = requests.compat.urljoin(page_url, action)
    # server actions exigem multipart/form-data
    multipart = {k: (None, v) for k, v in data.items()}
    for k, (fname, content, ctype) in (files or {}).items():
        multipart[k] = (fname, content, ctype)
    return sess.post(url, files=multipart, allow_redirects=True, headers={"Origin": BASE})


def find_form(sess, page_url, needle):
    """Índice do formulário cujo HTML contém `needle` (ex.: name="amount")."""
    soup = BeautifulSoup(sess.get(page_url).text, "html.parser")
    for i, f in enumerate(soup.find_all("form")):
        if needle in str(f):
            return i
    raise SystemExit(f"formulário com {needle} não encontrado em {page_url}")


stamp = int(time.time())
alice, bob = requests.Session(), requests.Session()

print("Cadastro e login")
r = submit(alice, f"{BASE}/register", 0, {"name": "Alice", "email": f"alice{stamp}@teste.dev", "password": "senha-forte-1"})
check("Minhas viagens" in r.text, "cadastro cria conta e leva para a home")
r = submit(bob, f"{BASE}/register", 0, {"name": "Bob", "email": f"bob{stamp}@teste.dev", "password": "senha-forte-2"})
check("Minhas viagens" in r.text, "segundo usuário cadastrado")

bad = requests.Session()
r = submit(bad, f"{BASE}/login", 0, {"email": f"alice{stamp}@teste.dev", "password": "errada-errada"})
check("E-mail ou senha incorretos" in r.text, "senha errada é rejeitada")

print("Viagem")
NEW = f"{BASE}/trips/new"
r = submit(alice, NEW, find_form(alice, NEW, 'name="destination"'), {
    "title": "Portugal E2E", "destination": "Lisboa", "startDate": "2026-11-10",
    "endDate": "2026-11-15", "timezone": "Europe/Lisbon", "baseCurrency": "BRL",
})
check("Portugal E2E" in r.text and "/trips/" in r.url, "viagem criada e página aberta")
trip_url = r.url.split("?")[0].rstrip("/")
trip_id = trip_url.rsplit("/", 1)[1]

r = submit(alice, NEW, find_form(alice, NEW, 'name="destination"'), {
    "title": "X", "destination": "Y", "startDate": "2026-11-10", "endDate": "2026-11-01",
})
check("A volta não pode ser antes da ida" in r.text, "validação de datas invertidas")

print("Roteiro")
it = f"{trip_url}/itinerary"
r = submit(alice, it, find_form(alice, it, 'name="arrival"'), {"name": "Lisboa", "country": "Portugal", "arrival": "2026-11-10"})
check("Lisboa" in r.text, "cidade adicionada")
ticket = ("ingresso.pdf", io.BytesIO(b"%PDF-1.4 teste"), "application/pdf")
r = submit(alice, it, find_form(alice, it, 'name="startTime"'), {
    "title": "Torre de Belém", "date": "2026-11-10", "startTime": "10:30", "type": "ATTRACTION",
}, files={"ticket": ticket})
check("Torre de Belém" in r.text and "ingresso.pdf" in r.text, "atividade com ingresso anexado")
r = submit(alice, it, find_form(alice, it, 'name="startTime"'), {"title": "Fora do período", "date": "2027-01-01"})
check("dentro do período da viagem" in r.text, "data fora da viagem é rejeitada")

print("Reservas")
bk = f"{trip_url}/bookings"
r = submit(alice, bk, find_form(alice, bk, 'name="confirmationCode"'), {
    "type": "FLIGHT", "title": "Voo GRU→LIS", "confirmationCode": "XYZ789",
    "startAt": "2026-11-10T07:15", "totalPrice": "3.450,90", "currency": "BRL",
})
check("Voo GRU" in r.text and "XYZ789" in r.text and "3.450,90" in r.text, "reserva de voo salva com valor pt-BR")

print("Custos")
ex = f"{trip_url}/expenses"
receipt = ("nota.png", io.BytesIO(b"\x89PNG\r\n\x1a\n fake"), "image/png")
r = submit(alice, ex, find_form(alice, ex, 'name="amount"'), {
    "description": "Almoço", "category": "FOOD", "date": "2026-11-10",
    "amount": "20,00", "currency": "EUR", "exchangeRate": "6,00",
}, files={"receipt": receipt})
check("Almoço" in r.text and "recibo" in r.text, "custo em EUR com recibo")
check("R$" in r.text and "120,00" in r.text, "total convertido (20 EUR × 6,00 = R$ 120,00)")
r = submit(alice, ex, find_form(alice, ex, 'name="amount"'), {"description": "Zero", "amount": "0"})
check("valor válido maior que zero" in r.text, "valor zero rejeitado")

print("Documentos")
dc = f"{trip_url}/documents"
r = submit(alice, dc, find_form(alice, dc, 'name="file"'), {"type": "PASSPORT", "title": "Passaporte Alice"},
           files={"file": ("pass.pdf", io.BytesIO(b"%PDF-1.4 pass"), "application/pdf")})
check("Passaporte Alice" in r.text, "documento enviado")
r = submit(alice, dc, find_form(alice, dc, 'name="file"'), {"type": "OTHER"},
           files={"file": ("mal.exe", io.BytesIO(b"MZ"), "application/x-msdownload")})
check("Formato não suportado" in r.text, "tipo de arquivo inválido rejeitado")

soup = BeautifulSoup(alice.get(dc).text, "html.parser")
link = next(a["href"] for a in soup.find_all("a") if a.get("href", "").startswith("/api/files/") )
r = alice.get(BASE + link)
check(r.status_code == 200 and r.content.startswith(b"%PDF"), "download do dono funciona")

print("Isolamento entre usuários (multi-tenant)")
r = bob.get(trip_url, allow_redirects=False)
check(r.status_code == 404, "Bob recebe 404 na viagem da Alice")
for sub in ("itinerary", "bookings", "expenses", "documents"):
    check(bob.get(f"{trip_url}/{sub}", allow_redirects=False).status_code == 404, f"Bob recebe 404 em /{sub}")
check(bob.get(BASE + link, allow_redirects=False).status_code == 404, "Bob não baixa arquivo da Alice")
check(requests.get(BASE + link).status_code == 401, "anônimo não baixa arquivo")
r = bob.get(BASE + "/")
check("Portugal E2E" not in r.text, "home do Bob não lista a viagem da Alice")

print("Logout")
r = submit(alice, BASE + "/", find_form(alice, BASE + "/", "Sair"))
check("Entrar" in r.text, "logout volta para o login")
check(alice.get(trip_url, allow_redirects=False).status_code in (307, 308), "após logout a viagem exige login")

print(f"\nTudo certo — {ok_count} verificações passaram.")
