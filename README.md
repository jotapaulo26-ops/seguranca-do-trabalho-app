# 🦺 SegTrabalho - Sistema de Gestão de Segurança do Trabalho

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fjotapaulo26-ops%2Fseguranca-do-trabalho-app)

Sistema completo e responsivo (Desktop e Smartphone / PWA) para gestão de Segurança e Saúde no Trabalho (SST), emissão de Análises Preliminares de Risco (APR) com rastreabilidade de dispositivos, mapa interativo de locais de risco (Trabalho em Altura e Espaços Confinados) com QR Code físico, cadastro de funcionários com controle de EPIs e treinamentos, e perfis de acesso personalizáveis.

---

## 📱 Teste Imediato no Celular (Link Público HTTPS)

Acesse diretamente pelo smartphone:
👉 **[https://4852b330c1f4a1.lhr.life](https://4852b330c1f4a1.lhr.life)**

---

## 🚀 Como Executar o Sistema

### 1. Iniciar Tudo com 1 Comando (Modo Desenvolvimento com Hot-Reload)
No diretório raiz do projeto:

```bash
npm run dev
```

Isso iniciará:
- **Backend API**: [http://localhost:5000](http://localhost:5000)
- **Frontend Web & Mobile**: [http://localhost:5173](http://localhost:5173) (com reload em tempo real)

---

### 2. Acessar do Smartphone (Mesma Rede Wi-Fi)
Você pode abrir o sistema diretamente no navegador do seu smartphone:
1. Abra o prompt de comando e digite `ipconfig` para verificar seu IP local (ex: `192.168.1.105`).
2. No celular, acesse:
   ```
   http://192.168.1.105:5173
   ```
   *(ou `http://192.168.1.105:5000` se estiver rodando a versão de produção)*
3. **Instalação como App (PWA):** No Chrome do celular, toque no menu de 3 pontos e escolha **"Adicionar à tela inicial"** ou **"Instalar aplicativo"**.

---

## 🔑 Contas de Acesso Pré-Cadastradas

| Perfil | E-mail | Senha | Atribuições |
|---|---|---|---|
| 👑 **Administrador** | `admin@segtrabalho.com.br` | `admin123` | Acesso total: cria perfis customizados, limita permissões de usuários, audita ações e gerencia a empresa. |
| 👷 **Técnico de SST** | `carlos.mendes@segtrabalho.com.br` | `tec123` | Emissão de APRs, cadastro de funcionários, mapeamento de riscos e coleta de assinaturas digitais. |

*Dica: Na tela de login há botões de **"Acesso Rápido para Testes"** que preenchem as credenciais com um clique.*

---

## 📱 Funcionalidades Principais

### 1. 📄 Emissão Completa de APRs em PDF
- **3 Modelos Especializados**:
  - `APR Trabalho em Altura (NR-35)`: cálculo de altura, pontos de ancoragem certificados, velocidade do vento e plano de resgate vertical.
  - `APR Espaço Confinado (NR-33)`: monitoramento de gases (O2, LEL, CO, H2S), vigia obrigatório e ventilação mecânica.
  - `APR Geral Operacional`: intervenções industriais, ferramentas e medidas preventivas.
- **Rastreabilidade Obrigatória do Dispositivo**:
  - Gravação automática do **ID Único do Aparelho (Device ID)** gerado por dispositivo/navegador.
  - Gravação da descrição do aparelho (ex: *Chrome 131 on Windows 11*, *Safari on iPhone*), endereço IP e data/hora.
- **Assinatura Digital no Touch / Mouse**:
  - Canvas interativo onde o responsável técnico e operadores assinam com o dedo na tela do celular ou mouse no PC.
- **Geração de PDF Completo**:
  - Cabeçalho corporativo com CNPJ.
  - Matriz de perigos vs. medidas preventivas.
  - Equipe executante com validação de status de aptidão.
  - Assinaturas digitais embutidas.
  - QR Code de validação de autenticidade no rodapé.

---

### 2. 🗺️ Mapa de Riscos Interativo (Altura & Espaço Confinado)
- **Clique no Mapa**: adicione novos pontos de risco simplesmente clicando no local desejado (coordenadas preenchidas automaticamente).
- **Categorização Visual**: marcadores coloridos por tipo de risco (🔴 Altura, 🟠 Espaço Confinado, 🟣 Risco Duplo).
- **Emissão Imediata de APR**: botão direto dentro do popup do local no mapa.
- **QR Code Físico para Placas**: gere e imprima placas com QR Code para colar no local físico da empresa. O operador escaneia com o smartphone e abre a APR daquele ponto.
- **Compatibilidade Google Maps**: o sistema funciona imediatamente com o mapa interativo integrado e permite adicionar a chave da Google Maps API nas Configurações quando desejar.

---

### 3. 👷 Gestão de Funcionários & Alertas SST
- Cadastro completo: Nome, CPF, Matrícula, Cargo, Setor, Data de Admissão e Contato.
- **Ficha de Treinamentos (NR-35, NR-33, NR-10, ASO)**:
  - Alerta visual verde (em dia), amarelo (vence nos próximos 30 dias) e **vermelho piscante (vencido)**.
  - **Bloqueio Automático na APR**: se um funcionário com NR-35 vencida for selecionado na APR de altura, o sistema alerta o emissor.
- **Ficha de EPIs**: registro de entrega com número de Certificado de Aprovação (C.A.) e validade de inspeção.

---

### 4. 🔐 Perfis de Acesso Customizados (RBAC Granular)
- O Administrador pode criar qualquer perfil (ex: *Técnico Júnior*, *Líder de Frente*, *Vigia*, *Auditor*).
- Controle granular de permissões por módulo:
  - `Visualizar`, `Criar`, `Editar`, `Excluir`, `Assinar Digitalmente`, `Gerenciar`.
- Atribuição flexível de usuários a cada perfil.

---

### 5. 🔍 Trilha de Auditoria & Histórico
- Registro imutável de todas as ações importantes no sistema (Login, Emissão de APR, Cadastro de Risco, Assinatura Digital, etc.).
- Detalhamento do usuário, módulo, data/hora, **ID do aparelho emissor** e endereço IP.

---

## 🛠️ Tecnologias Utilizadas

- **Frontend**: React 18, TypeScript, Tailwind CSS, Lucide Icons, Leaflet / React-Leaflet, Google Maps API, jsPDF, jspdf-autotable, qrcode.
- **Backend**: Node.js, Express, TypeScript, tsx, JWT, bcryptjs, multer, qrcode.
- **Armazenamento**: Engine JSON transacional estruturado com persistência síncrona atômica em disco (`backend/data/db.json`), com zero dependências externas de compilação C++, pronto para produção.
