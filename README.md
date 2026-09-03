# 🏥 Sistema TUSS • Motor de Busca & Consulta de Alta Performance

<div align="center">

![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![NodeJS](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![React](https://img.shields.io/badge/React_18-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS_v4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Nginx](https://img.shields.io/badge/Nginx-009639?style=for-the-badge&logo=nginx&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)

**Uma plataforma Full Stack escalável projetada para ingestão, tokenização e busca de alta performance sobre 1,44 milhão de registros da Terminologia Unificada da Saúde Suplementar (TUSS / ANS).**

[Apresentação](#apresentação) • [O Desafio de Engenharia](#o-desafio-de-engenharia) • [Arquitetura do Sistema](#arquitetura-do-sistema) • [Decisões Técnicas](#decisões-técnicas--destaques-de-engenharia) • [Estudo de Performance](#estudo-de-caso-de-otimização-de-397s-para-180ms) • [Tecnologias](#tecnologias-utilizadas) • [Como Executar na Máquina](#como-executar-o-projeto) • [Comandos Úteis](#comandos-úteis-packagejson) • [Documentação da API](#documentação-dos-endpoints-da-api) • [Benchmarks](#benchmarks-de-performance) • [Estrutura](#estrutura-de-diretórios)

</div>

---

## 📌 Apresentação <a id="apresentação"></a><a id="apresentacao"></a>

No ecossistema de saúde suplementar brasileiro, a **Terminologia Unificada da Saúde Suplementar (TUSS)**, padronizada pela **ANS (Agência Nacional de Saúde Suplementar)**, reúne catálogos extensos de medicamentos, diárias hospitalares, procedimentos e mais de 1,3 milhão de materiais e próteses (OPME).

Este projeto foi desenvolvido por **Jadson Cerqueira** como consolidação prática do curso de **Engenharia de Software**, abordando um desafio comum em sistemas com grandes volumes: **como modelar, otimizar e servir uma base de quase 1,5 milhão de registros sem gargalos de CPU e I/O**, garantindo respostas em frações de segundo.

Todo o desenvolvimento adotou práticas modernas de **engenharia assistida por IA**, utilizando inteligência artificial como parceira de produtividade (_pair programming_), mantendo a governança arquitetural, a modelagem relacional e os testes sob controle do desenvolvedor.

### 📊 Base de Dados Unificada

|   Código    | Tabela Normativa ANS                    | Total de Registros | Contexto & Metadados Estruturados                     |
| :---------: | :-------------------------------------- | :----------------: | :---------------------------------------------------- |
|  **Todas**  | **Visão Geral Consolidada**             |   **1.442.892**    | **Índices GIN + Trigram + Ranking Ponderado**         |
| **TUSS-18** | **Diárias, Taxas e Gases Medicinais**   |     **3.595**      | Diárias de UTI, taxas de sala e gases medicinais      |
| **TUSS-19** | **Materiais, Órteses, Próteses e OPME** |   **1.389.786**    | Fabricante, Modelo, Registro ANVISA e Classe de Risco |
| **TUSS-20** | **Medicamentos**                        |     **43.376**     | Apresentação comercial, forma farmacêutica e vigência |
| **TUSS-22** | **Procedimentos e Eventos em Saúde**    |     **5.967**      | Código de procedimento, Rol ANS e vigência            |
| **TUSS-24** | **CBO (Ocupação dos Prestadores)**      |      **168**       | Especialidades médicas e categorias profissionais     |

---

## 💡 O Desafio de Engenharia <a id="o-desafio-de-engenharia"></a>

Consultar **1,44 milhão de linhas** com resposta em menos de 100 milissegundos não é trivial para um banco relacional tradicional quando utilizamos abordagens ingênuas como `ILIKE '%termo%'`.

Os três principais obstáculos superados foram:

1. **Volume Desbalanceado:** A tabela TUSS-19 (OPME) concentra sozinha 1,38 milhão de itens, com campos textuais longos (especificações técnicas, modelos e nomes de fabricantes).
2. **Cardinalidade de Siglas Médicas:** Termos como _"US"_ (ultrassonografia), _"TC"_ (tomografia) ou _"RX"_ (raio-x) geram dezenas de milhares de ocorrências quando pesquisados por substring, travando queries e estourando memória.
3. **Navegação Fluida:** O usuário deve alternar entre categorias em tempo real, sem que o cálculo de contagem de páginas gere gargalos perceptíveis.

---

## 🏗 Arquitetura do Sistema <a id="arquitetura-do-sistema"></a>

A solução foi desenhada seguindo o **Padrão MVC (Model-View-Controller)** no backend e uma **Single Page Application (SPA)** desacoplada no frontend, orquestrada por containers Docker para desenvolvimento e produção:

```mermaid
graph TD
    subgraph Client ["🖥️ Frontend (React 18 + Vite + Tailwind v4)"]
        UI["Interface SPA"]
        Cards["Filtro por Categorias"]
        SearchInput["Busca Controlada (Enter / Botão)"]
        TableComp["Tabela Paginada e Modal de Detalhes"]
    end

    subgraph NginxProxy ["🌐 Nginx (Reverse Proxy em Produção)"]
        Proxy["Proxy Reverso (/api)"]
    end

    subgraph BackendMVC ["⚙️ Backend REST API (Node.js + Express MVC)"]
        Router["Rotas REST (/api/tuss, /api/stats)"]
        Controller["TussController (Validação e Resposta)"]
        Model["TussModel (Queries CTEs e Cache de Totais)"]
        Services["Serviços (FTS, Ingestão MD5, Otimização)"]
    end

    subgraph Database ["🗄️ PostgreSQL 16 (Motor de Indexação)"]
        Table["Tabela tuss_procedures (1.44M registros)"]
        Trigger["Trigger trg_tuss_search_update"]
        Unaccent["Função immutable_unaccent"]
        TSV["search_vector (tsvector ponderado A, B, C)"]
        Indexes["Índices GIN (FTS + Trigram) e B-Tree Composto"]
    end

    UI --> Cards
    Cards --> SearchInput
    SearchInput --> TableComp
    SearchInput --> Proxy
    Proxy --> Router
    Router --> Controller
    Controller --> Services
    Controller --> Model
    Model --> Table
    Table --> Trigger
    Trigger --> Unaccent
    Unaccent --> TSV
    Table --> Indexes
```

---

## 🚀 Decisões Técnicas & Destaques de Engenharia <a id="decisoes-tecnicas"></a><a id="decisões-técnicas--destaques-de-engenharia"></a>

### 1. 🏛️ Arquitetura MVC Modular e Limpa

O backend foi separado em camadas com responsabilidades bem definidas, facilitando testes, manutenção e escalabilidade:

- **`config/db.js`**: Gerencia o Pool de conexões do PostgreSQL e aplica migrações idempotentes (criação automática de extensões, tabelas, triggers e índices).
- **`models/tussModel.js`**: Isola o acesso a dados, consultas com CTEs de ranqueamento e cache em memória.
- **`controllers/tussController.js`**: Valida parâmetros de requisição, calcula o tempo de resposta em milissegundos e formata a resposta JSON.
- **`routes/tussRoutes.js`**: Mapeamento limpo das rotas RESTful.
- **`services/`**: Concentra regras de negócio pesadas, como construção de `tsquery` (`ftsService.js`), importação de arquivos com hash MD5 (`seedService.js`) e reindexação sob demanda (`optimizeService.js`).
- **`middlewares/errorHandler.js`**: Tratamento robusto de erros e rotas inexistentes sem expor stack traces sensíveis.

### 2. ⚡ Troca Instantânea de Categorias (< 10ms)

- **Índice B-Tree Composto (`idx_tuss_source_id`)**: Ao filtrar por categoria com ordenação por ID, o PostgreSQL faz um _Index Scan_ direto no índice composto `(source, id ASC)`, eliminando a necessidade de varrer a tabela no disco.
- **Cache de Contagem em Memória (`countCache`)**: Contar 1,38 milhão de linhas a cada clique para calcular a paginação custava ~1,5s no PostgreSQL. Com o cache em memória pré-aquecido na inicialização do servidor, a paginação padrão responde em **0 ms**.

### 3. 🧠 Tokenização e Full-Text Search com Pesos Hierárquicos

- **`search_vector tsvector`**: Vetor textual gerado com o dicionário linguístico em português e normalizado pela função `immutable_unaccent` para ignorar acentos e maiúsculas/minúsculas.
- **Pesos de Relevância Diferenciados**:
  - 🥇 **Peso A:** `codigo_tuss`: busca exata ou prefixo do código numérico.
  - 🥈 **Peso B:** `display_name`: descrição oficial do procedimento ou medicamento.
  - 🥉 **Peso C:** `fabricante` e `modelo` em metadados JSONB.
- **Trigger de Auto-Tokenização (`trg_tuss_search_update`)**: Toda inserção ou atualização no banco gera e atualiza os vetores de busca automaticamente.

### 4. 🎯 Algoritmo de Relevância Ponderada

> 📐 **Cálculo da Pontuação de Relevância:**  
> `Score = Bônus de Código Exato (100 pts) + Prefixo de Código (50 pts) + Início da Descrição (30 pts) + (ts_rank × 10)`

```sql
WITH candidates AS (
  SELECT
    p.id, p.codigo_tuss, p.display_name, p.source,
    p.inicio_vigencia, p.fim_vigencia, p.extras, p.search_vector
  FROM tuss_procedures p
  WHERE p.search_vector @@ to_tsquery('portuguese', immutable_unaccent($1))
     OR p.codigo_tuss ILIKE $2 || '%'
  LIMIT 2000
)
SELECT
  id, codigo_tuss, display_name, source, inicio_vigencia, fim_vigencia, extras,
  (
    CASE
      WHEN codigo_tuss = $2 THEN 100.0
      WHEN codigo_tuss ILIKE $2 || '%' THEN 50.0
      WHEN display_name ILIKE $2 || '%' THEN 30.0
      ELSE 0.0
    END
    + COALESCE(ts_rank(search_vector, to_tsquery('portuguese', immutable_unaccent($1))), 0.0) * 10.0
  ) AS relevance_score
FROM candidates
ORDER BY relevance_score DESC, id ASC
LIMIT $3 OFFSET $4;
```

### 5. 🤖 Engenharia Assistida por IA (AI-Assisted Engineering)

O uso de Inteligência Artificial foi incorporado como metodologia de trabalho e aceleração de desenvolvimento:

- **Papel da IA:** Atuou como ferramenta avançada de _pair programming_, apoiando na prototipagem ágil de componentes de UI, redução de código boilerplate, geração de massas e scripts para testes de estresse e documentação técnica.
- **Papel do Engenheiro de Software (Autor):** Responsável por todas as tomadas de decisão arquiteturais (adoção do MVC, isolamento de domínios), modelagem e relacionamento de tabelas, análise profunda de custos de planos de execução (`EXPLAIN ANALYZE`), escolha e calibração dos índices GIN/Trigram e orquestração de infraestrutura com Docker e Nginx.

---

## 🔥 Estudo de Caso de Otimização: De 39.7s para 180ms <a id="estudo-de-performance"></a><a id="estudo-de-caso-de-otimização-de-397s-para-180ms"></a>

### 🔴 O Cenário Crítico (39.720 ms)

Ao pesquisar termos curtos e muito frequentes como `"us"`:

- A query antiga com `ILIKE '%us%'` retornava mais de **500.000 matches** porque quase todas as palavras contêm "us" (_parafuso, uso, músculo, cirurgião_).
- O banco tentava calcular similaridade trigram e ordenar 500 mil registros na memória antes de aplicar o `LIMIT 15`.
- Resultado: A consulta demorava quase **40 segundos**.

### 🟢 A Solução Aplicada

1. **FTS Puro Indexado:** Substituição completa de `ILIKE '%termo%'` pelo operador `search_vector @@ to_tsquery()`, que utiliza os índices GIN invertidos.
2. **Tratamento Especial para Termos Curtos ($\le 2$ letras):** Converte siglas como `"us"` em `us | us:*`, evitando a expansão descontrolada de prefixos.
3. **Pool de Candidatos via CTE (`LIMIT 2000`):** O cálculo de relevância ocorre apenas sobre os 2.000 melhores candidatos selecionados pelo índice.
4. **Contagem Bounded (_Bounded Count_):** A contagem total para consultas de altíssima cardinalidade é limitada a 10.001 registros, garantindo resposta imediata sem sacrificar a paginação.

```text
Tempo de resposta para a busca "us" (1.44M registros):
Antes:  [████████████████████████████████████████] 39.720 ms
Depois: [█] 186 ms (⚡ Redução de 99,5% no tempo de resposta)
```

---

### 5. 📦 Ingestão em Massa com Rastreamento Criptográfico MD5

- **Tabela de Controle (`tuss_imported_files`)**: Cada arquivo JSON importado tem seu hash MD5 armazenado no banco.
- **Seed Incremental Inteligente**: Ao rodar o seed novamente ou adicionar novos arquivos na pasta `fonte/`, o sistema compara os hashes e **processa apenas os arquivos novos ou alterados**, pulando os já importados em frações de segundo.
- **Controle de Concorrência & Deduplicação**: Remoção de duplicatas em memória antes de cada lote de 1.000 itens (`INSERT ... ON CONFLICT`), evitando deadlocks e mantendo o consumo de RAM previsível.

### 6. 🐳 Ambientes Isolados com Docker Multi-Stage

- **Desenvolvimento (`docker-compose.yml`)**:
  - Hot-Reloading no Backend com `nodemon -L` (polling configurado para perfeita compatibilidade com Windows e WSL2).
  - Hot-Module Replacement (HMR) no Frontend com Vite.
  - Montagem de volumes somente-leitura (`./fonte:/app/fonte:ro`).
- **Produção (`docker-compose.prod.yml`)**:
  - Builds multi-stage otimizados.
  - Nginx servindo a SPA compilada com compressão e atuando como Proxy Reverso para a API.
  - Execução segura com usuário sem privilégios de root (`node`).

### 7. 🎨 Interface Moderna e Experiência do Usuário (UX)

- Componentes elegantes com **Tailwind CSS v4** e **Shadcn/UI**.
- **Cards Seletores Interativos**: Permitem filtrar e visualizar as contagens de cada categoria em tempo real no topo da página.
- **Busca por Demanda**: Disparada ao pressionar <kbd>Enter</kbd> ou clicar em **"Buscar"**, economizando requisições desnecessárias.
- Modal com visualização completa de atributos técnicos (ANVISA, fabricante, vigência, código e JSON original).
- Copiar código TUSS com 1 clique para a área de transferência com feedback visual.

---

## 🛠 Tecnologias Utilizadas <a id="tecnologias-utilizadas"></a>

| Camada             | Tecnologias & Bibliotecas                                                                      |
| :----------------- | :--------------------------------------------------------------------------------------------- |
| **Backend (MVC)**  | Node.js, Express.js, PostgreSQL Driver (`pg`), Dotenv, Cors, Crypto (MD5), Nodemon             |
| **Database**       | PostgreSQL 16, `pg_trgm`, `unaccent`, GIN Indexes, TSVector Full-Text Search, B-Tree Compostos |
| **Frontend**       | React 18, Vite 5, Tailwind CSS v4, `@tailwindcss/vite`, Shadcn/UI, Lucide React, Clsx          |
| **DevOps & Infra** | Docker, Docker Compose, Multi-Stage Builds, Nginx Alpine, Linux Containers                     |

---

## 💻 Como Executar o Projeto <a id="como-executar-o-projeto"></a><a id="como-executar"></a><a id="como-rodar"></a>

Você pode rodar o Sistema TUSS na sua máquina de três maneiras diferentes:

1. [**Opção 1: Via Docker Compose (Recomendado)**](#opcao-1-docker): Sobe Banco, Backend e Frontend isolados em containers com 1 comando.
2. [**Opção 2: Modo Híbrido (Banco no Docker + Backend e Frontend Nativos)**](#opcao-2-hibrida): Ideal para desenvolvimento rápido sem instalar PostgreSQL no SO.
3. [**Opção 3: Modo 100% Nativo na Máquina (Sem Docker)**](#opcao-3-nativa): Roda Node.js e PostgreSQL diretamente no sistema operacional.

---

### 📥 1. Clonar o Repositório

Em qualquer uma das opções, comece clonando o repositório e entrando na pasta do projeto:

```bash
# Via SSH (recomendado):
git clone git@github.com:jadsoncerqueira/sistema-tuss.git
cd sistema-tuss

# Ou via HTTPS:
git clone https://github.com/jadsoncerqueira/sistema-tuss.git
cd sistema-tuss
```

---

### 🐳 Opção 1: Execução via Docker Compose (Recomendado) <a id="opcao-1-docker"></a>

Esta é a forma mais simples e garantida de rodar o projeto em qualquer sistema operacional (Windows, Linux ou macOS).

#### Pré-requisitos

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) ou Docker Engine com plugin Compose instalado e em execução.
- [Node.js](https://nodejs.org/) (opcional, apenas se desejar usar os atalhos `npm run`).

#### Passo a Passo:

**1. Configurar o arquivo de variáveis de ambiente:**

```bash
# No Linux / macOS:
cp .env.example .env

# No Windows (PowerShell):
Copy-Item .env.example .env
```

**2. Subir os serviços de desenvolvimento (Hot-Reload ativado):**

```bash
# Usando atalho npm na raiz:
npm run dev

# Ou diretamente pelo Docker Compose:
docker compose up -d
```

**3. Acompanhar a inicialização e a carga dos dados (Auto-Seed):**

```bash
# Acompanhar os logs de todos os containers:
npm run dev:logs

# Ou acompanhar apenas os logs do backend em tempo real:
npm run dev:backend
```

> ⏳ **Atenção — Primeira Execução (Carga Inicial do Banco):**  
> Quando você executa o projeto pela **primeira vez**, o processo de inicialização é **mais demorado (pode levar alguns minutos)**.  
> Isso acontece porque o backend detecta automaticamente que o banco de dados está vazio e dispara o **Auto-Seed**, povoando e indexando quase **1,5 milhão de registros (1.442.892 linhas)** a partir dos arquivos oficiais da pasta `fonte/`. O banco processa os lotes, gera os vetores fonéticos de busca textual (_Full-Text Search_ em português com `unaccent`), monta os índices GIN invertidos e trigramas para garantir que as buscas respondam em frações de segundo.
>
> 💡 **Isso ocorre apenas uma vez:** Nas próximas vezes em que subir os containers, a inicialização será imediata (em menos de 2 segundos), pois os dados ficam gravados no volume persistente do Docker (`db_data_dev`) e o cache de totais já estará pré-aquecido na memória.

---

#### 📍 Onde o projeto vai estar rodando após os containers subirem:

Assim que o comando de inicialização for concluído e os containers estiverem ativos, você poderá acessar o projeto nos seguintes endereços locais:

| Serviço                             | O que é                                                                                | URL de Acesso Local                                                      |
| :---------------------------------- | :------------------------------------------------------------------------------------- | :----------------------------------------------------------------------- |
| 🖥️ **Frontend Web (Interface SPA)** | Aplicação React 18 + Vite + Tailwind v4 (Cards de categorias, busca por Enter e modal) | [http://localhost:5173](http://localhost:5173)                           |
| 🔌 **API REST (Backend Express)**   | Ponto de entrada da API e documentação de status                                       | [http://localhost:3000/api](http://localhost:3000/api)                   |
| 📊 **Estatísticas da Base**         | Endpoint JSON com as contagens consolidadas por tabela TUSS                            | [http://localhost:3000/api/stats](http://localhost:3000/api/stats)       |
| 🗄️ **Banco PostgreSQL 16**          | Conexão direta com o banco relacional e motor FTS                                      | `localhost:5432`<br>`(user: postgres \| senha: postgres \| db: tuss_db)` |

#### Para encerrar os containers:

```bash
npm run dev:down
# ou diretamente:
docker compose down
```

---

### ⚡ Opção 2: Execução Híbrida (Banco no Docker + Backend e Frontend Nativos) <a id="opcao-2-hibrida"></a>

Ideal para desenvolvimento e depuração no VS Code com máxima agilidade, dispensando a instalação manual do PostgreSQL no seu sistema.

#### Pré-requisitos

- [Docker Desktop](https://www.docker.com/) rodando (para o container do banco).
- [Node.js 18+](https://nodejs.org/) instalado na máquina.

#### Passo a Passo:

**1. Subir apenas o container do PostgreSQL:**

```bash
npm run local:db
# Ou: docker compose up db -d
```

**2. Instalar as dependências do Backend e Frontend:**

```bash
npm run local:install
# Ou individualmente:
cd backend && npm install
cd ../frontend && npm install
```

**3. Iniciar o Backend (Terminal 1):**

```bash
npm run local:backend
# Ou: cd backend && npm run dev
```

> O backend conecta automaticamente no banco em `localhost:5432`, aplica as migrações (tabelas, triggers e extensões `unaccent` e `pg_trgm`) e inicia o Auto-Seed.

**4. Iniciar o Frontend (Terminal 2):**

```bash
npm run local:frontend
# Ou: cd frontend && npm run dev
```

**5. Acessar:** Abra [http://localhost:5173](http://localhost:5173) no navegador.

---

### 💻 Opção 3: Execução 100% Nativa na Máquina (Sem Docker) <a id="opcao-3-nativa"></a>

Para rodar todo o ecossistema diretamente no sistema operacional da sua máquina.

#### Pré-requisitos

- [Node.js 18+](https://nodejs.org/)
- [PostgreSQL 16+](https://www.postgresql.org/download/) instalado e rodando como serviço local.

#### Passo a Passo:

**1. Criar o Banco de Dados no PostgreSQL:**
Acesse o terminal do PostgreSQL (`psql`) ou ferramenta gráfica (pgAdmin / DBeaver) e crie a base de dados:

```sql
CREATE DATABASE tuss_db;
```

_(Não se preocupe com tabelas ou extensões: o script `initDb()` do backend cria as extensões `unaccent` e `pg_trgm`, triggers e índices automaticamente na primeira conexão!)_

**2. Configurar o arquivo `.env` do Backend:**
Copie o modelo de ambiente dentro da pasta `backend`:

```bash
# No Linux / macOS:
cp backend/.env.example backend/.env

# No Windows (PowerShell):
Copy-Item backend/.env.example backend/.env
```

Abra o arquivo `backend/.env` e configure sua string de conexão com seu usuário e senha locais do PostgreSQL:

```env
DATABASE_URL=postgres://seu_usuario:sua_senha@localhost:5432/tuss_db
PORT=3000
NODE_ENV=development
```

**3. Instalar dependências e iniciar o Backend:**

```bash
cd backend
npm install
npm run dev
```

Você verá nos logs:

```text
✅ [Config] Estrutura do banco, tabelas de controle e índices GIN/Trigram verificados com sucesso.
🌱 [Server] Banco vazio detectado. Iniciando Auto-Seed de todos os arquivos TUSS em background...
🚀 [Server] Backend MVC rodando na porta 3000 [Modo: development]
```

_(Opcional: Caso queira forçar a sincronização manual dos dados via CLI: `npm run seed` dentro de `backend/`)_

**4. Instalar dependências e iniciar o Frontend:**
Abra um **segundo terminal** na raiz do projeto:

```bash
cd frontend
npm install
npm run dev
```

**5. Acessar a Aplicação:**
Abra o navegador em [http://localhost:5173](http://localhost:5173). O Vite realiza proxy reverso automático de todas as chamadas `/api` para a porta 3000 local!

---

### 🚀 Opção 4: Ambiente de Produção Otimizado (Docker + Nginx)

Para testar a versão final compilada com Nginx como proxy reverso e servidor estático de alta performance:

```bash
# Compila o frontend, empacota o backend de produção e sobe o Nginx na porta 5173:
npm run prod:build

# Para visualizar os containers ativos:
npm run prod:ps

# Para parar a produção:
npm run prod:down
```

- 🌐 **Aplicação em Produção (Nginx):** [http://localhost:5173](http://localhost:5173) (Porta 5173)
- 🔌 **Proxy da API:** [http://localhost:5173/api](http://localhost:5173/api)

---

## 📜 Comandos Úteis (`package.json`) <a id="comandos-úteis-packagejson"></a><a id="comandos-uteis"></a>

| Comando                         | Descrição                                                               |
| :------------------------------ | :---------------------------------------------------------------------- |
| **Docker (Desenvolvimento)**    |                                                                         |
| `npm run dev`                   | Inicia o ambiente completo no Docker com logs em tempo real             |
| `npm run dev:d`                 | Inicia o ambiente de desenvolvimento em background (modo detached)      |
| `npm run dev:build`             | Reconstrói as imagens de desenvolvimento e sobe os containers           |
| `npm run dev:logs`              | Exibe e acompanha os logs unificados de todos os containers             |
| `npm run dev:backend`           | Exibe os logs em tempo real apenas do container backend                 |
| `npm run dev:frontend`          | Exibe os logs em tempo real apenas do container frontend                |
| `npm run dev:down`              | Encerra e remove os containers de desenvolvimento                       |
| `npm run seed`                  | Executa a sincronização incremental dos arquivos de dados via container |
| `npm run seed:force`            | Força a reimportação completa de todos os arquivos ignorando hash MD5   |
| **Execução Local / Nativa**     |                                                                         |
| `npm run local:install`         | Instala as dependências do `backend` e `frontend` na máquina            |
| `npm run local:db`              | Inicia apenas o container do PostgreSQL em background                   |
| `npm run local:backend`         | Inicia o backend localmente na máquina com nodemon (porta 3000)         |
| `npm run local:frontend`        | Inicia o frontend localmente na máquina com Vite HMR (porta 5173)       |
| `npm run local:seed`            | Executa o script de ingestão/seed nativamente na máquina                |
| **Docker (Produção & Limpeza)** |                                                                         |
| `npm run prod`                  | Inicia o ambiente de produção em background                             |
| `npm run prod:build`            | Compila o frontend, constrói imagens de produção e sobe o Nginx         |
| `npm run prod:down`             | Encerra os containers do ambiente de produção                           |
| `npm run clean:all`             | Remove completamente todos os containers, redes e volumes criados       |
| **Testes & Estresse**           |                                                                         |
| `npm run test:stress`           | Executa teste de estresse automatizado com alta concorrência paralela   |

---

## 📡 Documentação dos Endpoints da API <a id="documentação-dos-endpoints-da-api"></a><a id="documentacao-da-api"></a>

### `GET /api/tuss`

Consulta paginada com busca textual tokenizada e ranqueamento por relevância.

#### Parâmetros aceitos:

| Parâmetro | Tipo      | Padrão | Descrição                                                                           |
| :-------- | :-------- | :----- | :---------------------------------------------------------------------------------- |
| `q`       | `string`  | `""`   | Termo de pesquisa (código, nome do procedimento, medicamento, fabricante ou modelo) |
| `source`  | `string`  | `all`  | Filtro por tabela (`all`, `tuss-18`, `tuss-19`, `tuss-20`, `tuss-22`, `tuss-24`)    |
| `page`    | `integer` | `1`    | Página atual da listagem                                                            |
| `limit`   | `integer` | `15`   | Quantidade de registros por página (máximo 100)                                     |

#### Exemplo de Resposta:

```json
{
  "data": [
    {
      "id": 69340,
      "codigo_tuss": "79989985",
      "display_name": "FRESAS DE TUNGSTÊNIO",
      "source": "tuss-19",
      "inicio_vigencia": "2020-01-01",
      "fim_vigencia": "-",
      "fim_implantacao": "2020-03-31",
      "extras": {
        "fabricante": "A.J.P. DE SUZA-ME",
        "modelo": "NÃO SE APLICA",
        "registro_anvisa": "80665750007",
        "classe_risco": "I"
      },
      "relevance_score": 115.0
    }
  ],
  "pagination": {
    "total": 1,
    "page": 1,
    "limit": 15,
    "totalPages": 1,
    "isCapped": false
  },
  "searchMeta": {
    "query": "79989985",
    "tokenQuery": "79989985:*",
    "executionTimeMs": 14
  }
}
```

---

### `GET /api/stats`

Retorna as estatísticas consolidadas e contagens de registros por categoria TUSS.

```json
{
  "totalProcedures": 1442892,
  "sources": [
    { "source": "tuss-19", "count": 1389786 },
    { "source": "tuss-20", "count": 43376 },
    { "source": "tuss-22", "count": 5967 },
    { "source": "tuss-18", "count": 3595 },
    { "source": "tuss-24", "count": 168 }
  ],
  "status": "online"
}
```

---

### `GET /api/tuss/:codigo`

Retorna todos os detalhes cadastrais e metadados de um código TUSS específico.

---

## ⚡ Benchmarks de Performance <a id="benchmarks-de-performance"></a><a id="benchmarks"></a>

### 1. Latência por Tipo de Consulta (Requisições Individuais)

| Cenário de Teste / Consulta               |    Volume da Base     | Estratégia Técnica                               | Tempo Médio de Resposta |
| :---------------------------------------- | :-------------------: | :----------------------------------------------- | :---------------------: |
| **Troca de Categoria (TUSS-19)**          | 1,38 milhão de linhas | Índice Composto `(source, id)` + Cache de Totais |        **~8ms**         |
| **Troca de Categoria (Todas)**            | 1,44 milhão de linhas | Scan Direto na Primary Key + Cache de Totais     |        **~2ms**         |
| **Busca por Código Exato** (`79989985`)   | 1,44 milhão de linhas | GIN Trigram + B-Tree em `codigo_tuss`            |        **~12ms**        |
| **Busca Multitermo** (`fresa tungstenio`) | 1,44 milhão de linhas | FTS GIN (`fresa:* & tungstenio:*`)               |        **~25ms**        |
| **Busca Ampla com Raiz** (`ultrasson`)    | 1,44 milhão de linhas | FTS Stemming Português (`ultrasson:*`)           |        **~85ms**        |
| **Busca Curta de Alta Frequência** (`us`) | 1,44 milhão de linhas | FTS GIN + CTE Candidate Pool (`LIMIT 2000`)      |       **~186ms**        |

### 2. 🧪 Teste de Estresse & Carga Concorrente (`npm run test:stress`)

O projeto inclui uma ferramenta automatizada em [`scripts/stressTest.js`](scripts/stressTest.js) para testes de carga realistas. O script simula múltiplos usuários simultâneos disparando requisições sem pausas sobre **21 cenários variados** (cache, filtros compostos, FTS multitermo e pior caso com termos curtos).

#### Como executar:

```bash
# Execução padrão (10 conexões simultâneas por 10 segundos):
npm run test:stress

# Ou personalizando o tempo e a concorrência diretamente:
# Sintaxe: node scripts/stressTest.js <DURAÇÃO_SEGUNDOS> <CONCORRÊNCIA>
node scripts/stressTest.js 15 20
```

#### Resultados Reais Sob Carga Concorrente:

| Métrica Avaliada              | Carga Moderada (5 Conexões Simultâneas) | Carga Intensa (20 Conexões Simultâneas) |
| :---------------------------- | :-------------------------------------: | :-------------------------------------: |
| **Total de Requisições**      |                 **114**                 |                 **219**                 |
| **Taxa de Sucesso (HTTP 200)** |              **100.0% (0 falhas)**      |              **100.0% (0 falhas)**      |
| **Vazão Média (Throughput)**   |             **11.4 req/s**              |             **13.6 req/s**              |
| **Latência Mediana (p50)**    |                **33 ms**                |               **352 ms**                |
| **Latência Média**            |               **304 ms**                |               **1.408 ms**              |
| **Estabilidade do Banco**     |   Sem saturação de memória ou CPU       |   Pool reciclado sem deadlock ou OOM    |

---

## 📂 Estrutura de Diretórios <a id="estrutura-de-diretórios"></a><a id="estrutura"></a>

```text
sistema-tuss/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── db.js            # Conexão Pool PostgreSQL, extensões e migrações
│   │   ├── controllers/
│   │   │   └── tussController.js # Lógica de requisição/resposta e formatação
│   │   ├── middlewares/
│   │   │   └── errorHandler.js  # Middleware global de erros (500) e 404
│   │   ├── models/
│   │   │   └── tussModel.js     # Interação com banco de dados (FTS, queries CTE)
│   │   ├── routes/
│   │   │   ├── index.js         # Roteador principal agregador (/api)
│   │   │   └── tussRoutes.js    # Rotas do TUSS (/api/tuss, /api/stats, /api/seed)
│   │   ├── services/
│   │   │   ├── ftsService.js    # Sanitizador e construtor de tsquery
│   │   │   ├── optimizeService.js # Reindexação e geração de vetores FTS
│   │   │   └── seedService.js   # Ingestão de dados com hash MD5 incremental
│   │   ├── app.js               # Configuração da aplicação Express
│   │   ├── server.js            # Inicializador HTTP e checagem de auto-seed
│   │   └── index.js             # Ponto de entrada compatível
│   ├── .env.example             # Modelo de variáveis de ambiente para backend local
│   ├── Dockerfile               # Multi-stage build (dev / prod)
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/ui/    # Design System Shadcn/UI (Button, Card, Table, Badge, Input)
│   │   ├── lib/utils.js      # Utilitário de classes Tailwind (clsx + twMerge)
│   │   ├── App.jsx           # Aplicação SPA com cards de categorias e busca por Enter
│   │   ├── index.css         # Tokens CSS e variáveis Tailwind v4
│   │   └── main.jsx
│   ├── public/
│   │   └── favicon.svg       # Favicon vetorial da aplicação
│   ├── nginx/
│   │   └── default.conf      # Configuração Nginx com Proxy /api para produção
│   ├── Dockerfile            # Multi-stage build (dev Vite / prod Nginx)
│   ├── vite.config.js        # Configuração do Vite com proxy e Tailwind v4
│   └── package.json
├── fonte/                    # Bases de dados oficiais (TUSS-18, TUSS-19, TUSS-20, TUSS-22, TUSS-24)
├── scripts/                  # Scripts de utilidade e testes de carga
│   └── stressTest.js         # Teste de estresse com cenários realistas e métricas p50/p95
├── docker-compose.yml        # Orquestração do ambiente de Desenvolvimento
├── docker-compose.prod.yml   # Orquestração do ambiente de Produção
├── .env.example              # Modelo de variáveis de ambiente raiz
├── package.json              # Scripts npm raiz para Docker e execução nativa
├── LICENSE                   # Licença de uso MIT
└── README.md                 # Documentação completa do projeto
```

---

## 👤 Autor <a id="autor"></a>

Desenvolvido por **Jadson Cerqueira**

- LinkedIn: [linkedin.com/in/jadsoncerqueira](https://www.linkedin.com)
- GitHub: [github.com/jadsoncerqueira](https://github.com)

---

## 📄 Licença <a id="licença"></a><a id="licenca"></a>

Este projeto está sob a licença [MIT](LICENSE).
