// Mapeamento simples nome do país (como o cliente digita, livre) -> bandeira.
// Cobre os destinos mais comuns; país não reconhecido cai no globo genérico.
const FLAGS: Record<string, string> = {
  "portugal": "🇵🇹",
  "espanha": "🇪🇸",
  "franca": "🇫🇷",
  "italia": "🇮🇹",
  "alemanha": "🇩🇪",
  "reino unido": "🇬🇧",
  "inglaterra": "🇬🇧",
  "holanda": "🇳🇱",
  "paises baixos": "🇳🇱",
  "belgica": "🇧🇪",
  "suica": "🇨🇭",
  "austria": "🇦🇹",
  "grecia": "🇬🇷",
  "irlanda": "🇮🇪",
  "croacia": "🇭🇷",
  "republica tcheca": "🇨🇿",
  "polonia": "🇵🇱",
  "turquia": "🇹🇷",
  "marrocos": "🇲🇦",
  "egito": "🇪🇬",
  "emirados arabes unidos": "🇦🇪",
  "estados unidos": "🇺🇸",
  "eua": "🇺🇸",
  "canada": "🇨🇦",
  "mexico": "🇲🇽",
  "argentina": "🇦🇷",
  "chile": "🇨🇱",
  "uruguai": "🇺🇾",
  "peru": "🇵🇪",
  "colombia": "🇨🇴",
  "brasil": "🇧🇷",
  "japao": "🇯🇵",
  "china": "🇨🇳",
  "tailandia": "🇹🇭",
  "india": "🇮🇳",
  "australia": "🇦🇺",
  "nova zelandia": "🇳🇿",
};

function normalize(name: string) {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function countryFlag(country: string): string {
  return FLAGS[normalize(country)] ?? "🌍";
}
