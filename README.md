This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/basic-features/font-optimization) to automatically optimize and load Inter, a custom Google Font.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js/) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/deployment) for more details.


### Fluxo completo – passo a passo

---

#### 1. Criação do FIDC  
```solidity
initializeFIDC(
  address _manager,     // gestor do fundo
  address _validator,   // auditor que libera a emissão
  address _payable,     // carteira que recebe/manda pagamentos
  uint256 _fee,         // taxa do gestor (basis points)
  uint256 _annualYield, // rentabilidade alvo (basis points)
  uint256 _gracePeriod, // carência antes do 1º pagamento
  uint256 _seniorSpread // spread da classe sênior (basis points)
)
```

* **Quem assina?** a carteira do **manager** (`.env → NEXT_PUBLIC_PRIVATE_KEY_MANAGER`).  
* **Onde escolho o endereço?** componente **WalletSelector**.  
* **Resultado:** um novo FIDC é criado; guardamos o `fidcId` que o evento `FIDCCreated` devolve.

---

#### 2. Aporte inicial dos investidores  
```solidity
invest(uint256 fidcId, uint256 amount)
```

* Usamos a **demoWallet** (private-key dentro do código) como investidor-teste.  
* Antes de chamar `invest`, damos **approve** no token MockERC20 (stablecoin) para o contrato `FIDC_Management_address`.  
* Neste exemplo enviamos um valor alto para encher a liquidez do fundo.

---

#### 3. Antecipação de recebíveis para o PJ  
```solidity
anticipation(uint256 amount, address collateralToken, uint256 fidcId)
```

* **Carteira usada:** a do **PJ** (`.env → NEXT_PUBLIC_PRIVATE_KEY_PJ`).  
* O PJ já possui o token de garantia (`collateral_address`).  
* Passos no front-end:  
  1. `approve` do **collateralToken** para o contrato FIDC.  
  2. Chamada de `anticipation`.  
* Evento disparado:  
  ```solidity
  Anticipation(fidcId, pj, amount, collateralToken, requiredCollateral)
  ```  
  * `amount` → valor que o PJ antecipou (recebe em stablecoin).  
  * `requiredCollateral` → quanto de colateral saiu da carteira dele.

---

#### 4. Pagamento do adquirente (liquidando o recebível)  
```solidity
compensationPay(uint256 fidcId, uint256 amount)
```

* **Carteira usada:** **adquirente** (`NEXT_PUBLIC_PRIVATE_KEY_ADQUIRENTE`).  
* Como encontrar `amount` certo:  
  1. `address rec = FIDC_Management.getFIDCReceivable(fidcId);`  
  2. `uint256 toPay = ERC20(rec).balanceOf(FIDC_Management_address);`  
* Transferimos exatamente `toPay` em stablecoin.  
* Evento disparado:  
  ```solidity
  CompensationProcessed(
    fidcId,
    adquirente,
    amount,
    collateralTokenAddress,
    collateralAmount,
    isExternalCollateral
  )
  ```

---

#### 5. Resgate final pelo gestor  
```solidity
redeemAllManager(uint256 fidcId)
```

* **Quem assina?** o **manager** do fundo.  
* Ele passa a lista de investidores e distribui principal + rendimentos.  
* Evento principal:  
  ```solidity
  FIDCRedemption(
    fidcId,
    investor,
    investmentAmount,
    grossYield,
    netYield,
    managerFee,
    quotasBurned,
    isSenior,
    investmentDate,
    redemptionDate
  )
  ```  
  Todas essas informações devem ser exibidas no front-end para que o usuário veja a liquidação completa do ativo.

---

##### Resumindo o fluxo

1. **Manager** cria o fundo ➜ recebe `fidcId`.  
2. **Investidores** aprovam stablecoin e chamam `invest`.  
3. **PJ** deposita colateral e antecipa (`anticipation`).  
4. **Adquirente** quita o recebível (`compensationPay`).  
5. **Manager** encerra e distribui valores (`redeemAllManager`).  

Cada etapa emite eventos que o front captura para mostrar status e valores ao usuário de forma transparente.