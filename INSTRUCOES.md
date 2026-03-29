# Como Rodar o App no Celular (Sem Computador)

## Pre-requisitos
- Celular com **Expo Go** instalado (App Store / Google Play)
- Uma **Google Cloud Vision API Key** (instruções abaixo)

---

## PASSO 1: Criar a API Key do Google (5 min)

1. Abra o navegador do celular e acesse: **console.cloud.google.com**
2. Faca login com sua conta Google
3. Crie um projeto novo (ou use um existente):
   - Toque no seletor de projeto no topo
   - Toque em **"Novo Projeto"**
   - De um nome (ex: "OCR App") e toque em **"Criar"**
4. Ative a Cloud Vision API:
   - No menu lateral, va em **"APIs e Servicos" > "Biblioteca"**
   - Pesquise por **"Cloud Vision API"**
   - Toque em **"Ativar"**
5. Crie a API Key:
   - No menu lateral, va em **"APIs e Servicos" > "Credenciais"**
   - Toque em **"Criar Credenciais" > "Chave de API"**
   - **Copie a chave gerada** (sera algo como: AIzaSyD...)

> O free tier permite 1000 requisicoes/mes gratuitamente.

---

## PASSO 2: Abrir o App no Expo Snack (3 min)

1. Abra o navegador do celular e acesse: **snack.expo.dev**
2. Toque em **"Create Snack"** (canto superior direito)
3. Voce vera um editor de codigo. **Apague todo o conteudo** do arquivo `App.js`
4. Abra o arquivo do app em outra aba do navegador:
   - Acesse: **github.com/rafaalmeida/ocr-codigo**
   - Mude para o branch **claude/mobile-text-capture-app-THzFW**
   - Navegue ate a pasta: **snack/App.js**
   - Toque no arquivo para abrir
   - Toque no botao **"Raw"** para ver o codigo puro
   - **Selecione tudo** (toque longo > "Selecionar Tudo") e **copie**
5. Volte para a aba do Snack e **cole** o codigo no editor

---

## PASSO 3: Configurar Dependencias no Snack

1. No painel esquerdo do Snack, procure a secao **"Dependencies"** (ou um icone de pacote)
2. Adicione cada uma destas dependencias (toque em "Add dependency" e pesquise):
   - `expo-camera`
   - `expo-file-system`
   - `expo-sharing`
   - `@react-native-async-storage/async-storage`

---

## PASSO 4: Rodar no Celular

1. No Snack, toque na aba **"My Device"** (no painel de preview a direita)
2. Aparecera um **QR Code**
3. **Escaneie o QR Code**:
   - **iOS**: Abra a camera nativa e aponte para o QR code
   - **Android**: Abra o Expo Go e toque em "Scan QR Code"
4. O app abrira automaticamente no Expo Go

---

## PASSO 5: Usar o App

1. **Tela Inicial**:
   - Selecione o tipo de dado (ex: "Codigos") ou descreva manualmente
   - Cole sua API Key do Google Cloud Vision
   - Toque em **"Iniciar Captura"**

2. **Tela de Camera**:
   - Aponte a camera para o texto que deseja capturar
   - Toque no botao **"Capturar"** (circulo azul)
   - Um modal mostrara os textos detectados
   - **Toque no dado correto** para confirmar

3. **Captura Automatica**:
   - Apos confirmar, o app entra em modo automatico
   - Ele capturara dados similares a cada ~2.5 segundos
   - Um badge vermelho "Capturando" aparece no topo
   - A lista de itens capturados aparece na parte inferior

4. **Parar e Exportar**:
   - Toque em **"Parar Captura"** (botao vermelho)
   - Na tela de resultados, revise os dados
   - Toque no **X** para remover itens incorretos
   - Toque em **"Compartilhar CSV"** para enviar o arquivo por:
     - WhatsApp, Telegram, E-mail
     - Google Drive, iCloud, Dropbox
     - Qualquer app de compartilhamento do seu celular

---

## Solucao de Problemas

| Problema | Solucao |
|----------|---------|
| "Erro na API Vision" | Verifique se a API Key esta correta e a Cloud Vision API esta ativada |
| Camera nao abre | Toque em "Permitir Camera" quando solicitado. Se nao aparecer, va em Ajustes > Expo Go > Camera |
| Nenhum texto detectado | Aproxime mais a camera do texto. Garanta boa iluminacao |
| App lento no Snack | Normal no modo Snack. Para melhor performance, rode o projeto localmente (npm install + npx expo start) |
