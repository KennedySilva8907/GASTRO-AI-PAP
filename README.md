# GastroAI

![Coverage](https://img.shields.io/badge/coverage-86%25-brightgreen)
![Lighthouse Performance](https://img.shields.io/badge/lighthouse%20performance-95-brightgreen)
![Lighthouse Accessibility](https://img.shields.io/badge/accessibility-95-brightgreen)
![Lighthouse Best Practices](https://img.shields.io/badge/best%20practices-100-brightgreen)
![Lighthouse SEO](https://img.shields.io/badge/seo-90-brightgreen)

Plataforma web de culinária que combina desafios a tempo real, galeria de receitas e um assistente de inteligência artificial gastronómica, alimentada pela API Gemini do Google.

## Demo

[gastro-ai-pap.vercel.app](https://gastro-ai-pap.vercel.app) 

## Funcionalidades

- **Desafio Culinário** — Receitas geradas dinamicamente por IA, com timer regressivo e 4 níveis de dificuldade (Principiante, Intermédio, Avançado, Extremo)
- **Chat com IA** — Assistente gastronómico especializado com histórico de conversa, exportação de chat e animação de digitação
- **Galeria de Receitas** — Carrossel vertical com 10 receitas internacionais, vídeos do YouTube e detalhes completos em modal
- Animações físicas interativas com **Matter.js** e **GSAP**
- Design totalmente responsivo (mobile e desktop)

## Stack Técnica

| Camada | Tecnologia |
|--------|-----------|
| Frontend | HTML5, CSS3, JavaScript (ES6+) |
| Animações | GSAP, Matter.js, Anime.js |
| IA | Google Gemini API (gemini-2.0-flash-exp) |
| Backend | Node.js (Vercel Serverless Functions) |
| Deploy | Vercel |

## Como Executar Localmente

### Pré-requisitos
- Node.js >= 16
- Uma chave da [Google AI Studio](https://aistudio.google.com/app/apikey)

### Passos

```bash
# 1. Clonar o repositório
git clone https://github.com/seu-utilizador/GASTRO-AI-PAP.git
cd GASTRO-AI-PAP

# 2. Instalar dependências
npm install

# 3. Configurar variáveis de ambiente
cp .env.example .env
# Editar .env e preencher GEMINI_API_KEY com a sua chave

# 4. Iniciar o servidor
npm run dev
```

Abrir `index.html` no browser ou servir com um servidor local (Live Server, etc.).

## Variáveis de Ambiente

| Variável | Descrição | Obrigatória |
|----------|-----------|-------------|
| `GEMINI_API_KEY` | Chave da API Gemini do Google | Sim |
| `ALLOWED_ORIGIN` | Domínio permitido para CORS (ex: `https://seu-projeto.vercel.app`) | Não (padrão: `*`) |

Consulte [`.env.example`](.env.example) para referência.

## Deploy (Vercel)

1. Fazer fork/clone para a sua conta GitHub
2. Importar o projeto no [Vercel](https://vercel.com)
3. Configurar as variáveis de ambiente no painel do Vercel:
   - `GEMINI_API_KEY` — a sua chave da API
   - `ALLOWED_ORIGIN` — o URL do seu projeto Vercel
4. O deploy acontece automaticamente a cada push para `main`

## Estrutura do Projeto

```
GASTRO-AI-PAP/
├── index.html              # Página principal (menu)
├── main.js                 # Animações da página principal
├── style.css               # Estilos globais
├── api/
│   └── index.js            # Serverless function (proxy da API Gemini)
├── Chat bot/
│   └── script.js           # Lógica do assistente de IA
├── Desafios/
│   └── script.js           # Lógica dos desafios culinários
├── Receitas/
│   └── script.js           # Lógica da galeria de receitas
├── public/                 # Páginas HTML das subpáginas
├── .env.example            # Modelo de variáveis de ambiente
├── vercel.json             # Configuração de routing Vercel
└── package.json
```

## Autor

**Kennedy Silva**
Projeto de Conclusão de Curso (PAP)

---

*Desenvolvido com Node.js e Google Gemini API*
