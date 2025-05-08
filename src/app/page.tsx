"use client";
import { useState, useRef, useEffect } from "react";
import CapitareHeader from "@/components/CapitareHeader";
import { useContract } from "@/hooks/useContract";
import { EventData } from "@/interfaces";
import { TransactionStatus } from "@/components/TransactionStatus";
import { toast } from "react-hot-toast";
import { adminAddresses } from "@/constants";

interface Config{
  fee: number;
  annual: number;
  grace: number;
  senior: number;
}

export default function ManagerPage() {
  const {
    onInitializeFIDC,
    onInvestFIDC,
    onAnticipation,
    onCompensation,
    onRedeem,
    updateBalances,
    fidcId: contractFidcId,
    setFidcId: setContractFidcId,
    stablecoinBalance,
    receivablesBalance,
    logs,
    clearLogs,
    isProcessing,
    onGetFIDC,
    onGetAllInvestors,
    txHash,
    getReceivablesAmount
  } = useContract();

  const [currentOperation, setCurrentOperation] = useState<string>("");
  const [currentEvents, setCurrentEvents] = useState<EventData[]>([]);
  const [investors, setInvestors] = useState<string[]>([]);
  const [showInvestors, setShowInvestors] = useState<boolean>(false);
  const [forceOpenModal, setForceOpenModal] = useState<boolean>(false);
  const [configsFidic, setConfigFidic] = useState<Config>({
    fee: 100,
    annual: 1800,
    grace: 35,
    senior: 500
  })
  const [compensationValue, setCompensationValue] = useState<any>(null)
  const [receivableLimit, setReceivableLimit] = useState<any>(null)
  const [investAmount, setInvestAmount] = useState(1000);
  const [anticipationAmount, setAnticipationAmount] = useState(500);
  const [inputFidcId, setInputFidcId] = useState<string>("");
  const [guaranteeType, setGuaranteeType] = useState<
    "consignado" | "cartao" | "duplicata"
  >("cartao");
  const [selectedInvestor, setSelectedInvestor] = useState<string>("demo");
  const [investorType, setInvestorType] = useState<"senior" | "subordinado">(
    "senior"
  );

  console.log(contractFidcId)

  useEffect(() => {
    async function getReceivables() {
      try{
        if(contractFidcId){
          const response = await getReceivablesAmount(contractFidcId);
          console.log(response)
          setReceivableLimit(Number(response));
        }
      }catch(err){
        console.log(err);
      }
    }

    if(contractFidcId){
      getReceivables();
    }
  },[contractFidcId, currentEvents, currentOperation]);

  const handleInitializeFIDC = async () => {
    try {
      setCurrentOperation("Inicialização de FIDC");
      setCurrentEvents([]);
      setShowInvestors(false);
      const result = await onInitializeFIDC(configsFidic);
      setCurrentEvents(result.events || []);
    } catch (error) {
      console.error("Erro ao inicializar FIDC:", error);
    }
  };

  const handleInvestFIDC = async () => {
    if (!contractFidcId || investAmount <= 0) return;

    try {
      setCurrentOperation("Investimento");
      setCurrentEvents([]);
      setShowInvestors(false);

      const result = await onInvestFIDC(
        contractFidcId,
        investAmount,
        investorType,
        selectedInvestor as
          | "demo"
          | "pj_or_investor1"
          | "pj_or_investor2"
          | "pj_or_investor3"
          | "pj_or_investor4"
      );

      // Combina os eventos de aprovação e investimento
      if (result) {
        const allEvents = [
          ...(result.approveEvents || []),
          ...(result.investEvents || []),
        ];
        console.log("Todos os eventos:", allEvents);
        setCurrentEvents(allEvents);
        setForceOpenModal(true);
      }
    } catch (error) {
      console.error("Erro no investimento:", error);
      toast.error("Erro ao realizar investimento");
    }
  };

  const handleAnticipation = async (
    guaranteeType: "consignado" | "cartao" | "duplicata"
  ) => {
    if (!contractFidcId || anticipationAmount <= 0) return;

    try {
      setCurrentOperation("Antecipação");
      setCurrentEvents([]);
      setShowInvestors(false);
      const result = await onAnticipation(
        contractFidcId,
        anticipationAmount,
        guaranteeType
      );
      setCurrentEvents(result.events || []);
    } catch (error) {
      console.error("Erro na antecipação:", error);
    }
  };

  const handleCompensation = async () => {
    if (!contractFidcId) return;

    try {
      setCurrentOperation("Pagamento do Adiquirente");
      setCurrentEvents([]);
      setShowInvestors(false);
      const result = await onCompensation(contractFidcId, compensationValue);
      setCurrentEvents(result.events || []);
    } catch (error) {
      console.error("Erro no pagamento do adiquirente:", error);
    }
  };

  const handleRedeem = async () => {
    if (!contractFidcId) return;

    try {
      setCurrentOperation("Liquidação");
      setCurrentEvents([]);
      setShowInvestors(false);
      const result = await onRedeem(contractFidcId);
      setCurrentEvents(result.events || []);
    } catch (error) {
      console.error("Erro no liquidação:", error);
    }
  };

  const handleLoadFidc = async () => {
    if (!inputFidcId) return;

    try {
      setCurrentOperation("Verificação de FIDC");
      setCurrentEvents([]);
      const fidcIdNumber = Number(inputFidcId);

      const result = await onGetFIDC(fidcIdNumber);

      if (!result) {
        toast.error(`FIDC ${fidcIdNumber} não encontrado ou não existe`);
        setInputFidcId("");
      } else {
        toast.success(`FIDC ${fidcIdNumber} carregado com sucesso`);
        setContractFidcId(fidcIdNumber);
      }
    } catch (error) {
      console.error("Erro ao carregar FIDC:", error);
      toast.error("Erro ao carregar FIDC");
      setInputFidcId("");
    }
  };

  const handleGetAllInvestors = async () => {
    if (!contractFidcId) return;

    try {
      setCurrentOperation("Lista de Investidores");
      setCurrentEvents([]);
      setShowInvestors(true);
      setForceOpenModal(true);

      const result = await onGetAllInvestors(contractFidcId);
      if (result && result.investors) {
        setInvestors(result.investors);
      } else {
        setInvestors([]);
      }
    } catch (error) {
      console.error("Erro ao obter lista de investidores:", error);
      setInvestors([]);
    }
  };

  function formatBigInt(raw: string | number | bigint): number {
    const value = BigInt(raw); // conversão segura
    const divisor = BigInt("1000000000000000000"); // 1e18
    const result = value / divisor;
    return Number(result);
  }

  return (
    <div className="capitare-gradient-bg min-h-screen pt-20 pb-12">
      <CapitareHeader />

      <div className="capitare-container mx-auto px-4">
        <h1 className="capitare-section-title text-center mb-12">
          Plataforma de Gestão de FIDC
        </h1>

        <p className="text-center text-white mb-8 max-w-3xl mx-auto">
          A Capitare oferece um processo simples e intuitivo para investir em
          FIDCs com alto potencial. Veja abaixo as etapas para começar a
          investir com a Capitare.
        </p>

        <TransactionStatus
          hash={txHash}
          isProcessing={isProcessing}
          operation={currentOperation}
          events={currentEvents}
          investors={showInvestors ? investors : undefined}
          forceOpen={forceOpenModal}
          onModalClose={() => setForceOpenModal(false)}
        />

        <div className="mb-8">
          <div className="capitare-card">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-700 mb-2 flex items-center justify-between w-full">
                  Saldos Disponíveis - FIDC ID: {contractFidcId || "N/A"}{" "}
                  <button
                    onClick={updateBalances}
                    className="capitare-btn-outline px-4 py-2 flex items-center justify-center gap-2"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                    Atualizar Saldos
                  </button>
                </h3>

                {(Number(stablecoinBalance) > 0 ||
                  Number(receivablesBalance) > 0) && (
                  <div className="w-full h-12 rounded-full overflow-hidden flex mb-4">
                    {(() => {
                      const stablecoinValue = Number(stablecoinBalance);
                      const receivablesValue = Number(receivablesBalance);
                      const total = stablecoinValue + receivablesValue;

                      const stablecoinPercentage =
                        total > 0
                          ? Math.round((stablecoinValue / total) * 100)
                          : 0;
                      const receivablesPercentage =
                        total > 0 ? 100 - stablecoinPercentage : 0;

                      return (
                        <>
                          <div
                            className="h-full flex items-center justify-center text-white font-medium"
                            style={{
                              width: `${stablecoinPercentage}%`,
                              backgroundColor: "#111d3b",
                            }}
                          >
                            {stablecoinPercentage > 10 &&
                              `${stablecoinPercentage}%`}
                          </div>
                          <div
                            className="h-full flex items-center justify-center text-gray-700 font-medium"
                            style={{
                              width: `${receivablesPercentage}%`,
                              backgroundColor: "#dbe5ff",
                            }}
                          >
                            {receivablesPercentage > 10 &&
                              `${receivablesPercentage}%`}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="text-sm text-blue-600 font-medium mb-1">
                      Stablecoin (Moeda Estável)
                    </div>
                    <div className="text-2xl font-bold text-blue-800">
                      {Number(stablecoinBalance).toLocaleString()} Stablecoin
                    </div>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <div className="text-sm text-purple-600 font-medium mb-1">
                      Recebíveis
                    </div>
                    <div className="text-2xl font-bold text-purple-800">
                      {Number(receivablesBalance).toLocaleString()} REC
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-8">
          <div className="capitare-card">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">
              Carregar FIDC Existente
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="flex gap-2">
                <input
                  type="number"
                  value={inputFidcId.replace(/^0+(?=\d)/, "")}
                  onChange={(e) =>
                    setInputFidcId(e.target.value.replace(/^0+(?=\d)/, ""))
                  }
                  placeholder="Digite o ID do FIDC"
                  className="capitare-input flex-1"
                />
                <button
                  onClick={handleLoadFidc}
                  disabled={isProcessing || !inputFidcId}
                  className="capitare-btn"
                >
                  {isProcessing ? "Verificando..." : "Carregar"}
                </button>
              </div>

              {contractFidcId !== null ? (
                <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-green-700">
                  FIDC ID atual: {contractFidcId}
                </div>
              ) : (
                <div className="mt-2 text-sm text-gray-500 italic">
                  Nenhum FIDC carregado
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 mb-12">
          <div className="capitare-card">
            <div className="capitare-icon">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h2 className="capitare-card-title">Consultar Investidores</h2>

            <div className="space-y-4">
              <button
                onClick={handleGetAllInvestors}
                disabled={isProcessing || !contractFidcId}
                className="capitare-btn w-full"
              >
                {isProcessing ? "Processando..." : "Consultar Investidores"}
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mb-12">
          <div className="capitare-card">
            <div className="capitare-icon">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
            </div>
            <h2 className="capitare-card-title">Inicializar FIDC</h2>

            <div className="space-y-4">
              <div>
                <label className="capitare-input-label">
                  Endereço do Gestor
                </label>
                <input
                  type="text"
                  value={adminAddresses.manager_address}
                  className="capitare-input"
                  placeholder="1000"
                  readOnly
                />
              </div>
              <div>
                <label className="capitare-input-label">Spread do Gestor</label>
                <input
                  type="number"
                  value={configsFidic.fee}
                  onChange={(e) => {
                    let value = e.target.value.replace(/^0+(?=\d)/, "");
                    let number = value === "" ? 0 : Number(value);
                    number = Math.max(100, Math.min(1000, number));
                    setConfigFidic({ ...configsFidic, fee: number });
                  }}
                  className="capitare-input"
                  defaultValue={100}
                />
              </div>

              <div>
                <label className="capitare-input-label">Juros Anuais</label>
                <input
                  type="number"
                  value={configsFidic.annual}
                  onChange={(e) => {
                    let value = e.target.value.replace(/^0+(?=\d)/, "");
                    let number = value === "" ? 0 : Number(value);
                    number = Math.max(0, Math.min(20000, number));
                    setConfigFidic({ ...configsFidic, annual: number });
                  }}
                  className="capitare-input"
                  defaultValue={1800}
                />
              </div>

              <div>
                <label className="capitare-input-label">Tempo para Liquidação (Segundos)</label>
                <input
                  type="number"
                  value={configsFidic.grace}
                  onChange={(e) => {
                    let value = e.target.value.replace(/^0+(?=\d)/, "");
                    let number = value === "" ? 0 : Number(value);
                    const maxGrace = 3 * 365 * 24 * 60 * 60;
                    number = Math.max(35, Math.min(maxGrace, number));
                    setConfigFidic({ ...configsFidic, grace: number });
                  }}
                  className="capitare-input"
                  defaultValue={35}
                />
              </div>

              <div>
                <label className="capitare-input-label">Spread Senior</label>
                <input
                  type="number"
                  value={configsFidic.senior}
                  onChange={(e) => {
                    let value = e.target.value.replace(/^0+(?=\d)/, "");
                    let number = value === "" ? 0 : Number(value);
                    number = Math.max(0, Math.min(2000, number));
                    setConfigFidic({ ...configsFidic, senior: number });
                  }}
                  className="capitare-input"
                  defaultValue={500}
                />
              </div>

              <button
                onClick={handleInitializeFIDC}
                disabled={isProcessing}
                className="capitare-btn w-full"
              >
                {isProcessing ? "Processando..." : "Inicializar Novo FIDC"}
              </button>

              {contractFidcId && (
                <div className="bg-green-50 border-l-4 border-green-400 p-3 mt-3">
                  <p className="text-sm text-green-700">
                    <span className="font-semibold">FIDC Active</span> - ID:{" "}
                    {contractFidcId}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="capitare-card">
            <div className="capitare-icon">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h2 className="capitare-card-title">Investir no FIDC</h2>

            <div className="space-y-4">
              <div>
                <label className="capitare-input-label">
                  Valor do Investimento
                </label>
                <input
                  type="number"
                  value={investAmount === 0 ? "" : investAmount}
                  onChange={(e) => {
                    const value = e.target.value.replace(/^0+(?=\d)/, "");
                    setInvestAmount(value === "" ? 0 : Number(value));
                  }}
                  className="capitare-input"
                  placeholder="1000"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de Investidor
                </label>
                <select
                  value={investorType}
                  onChange={(e) =>
                    setInvestorType(e.target.value as "senior" | "subordinado")
                  }
                  className="capitare-input bg-blue-50 border border-blue-300 text-blue-800 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition-colors"
                >
                  <option value="senior">Senior</option>
                  <option value="subordinado">Subordinado</option>
                </select>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Investidor
                </label>
                <select
                  value={selectedInvestor}
                  onChange={(e) => setSelectedInvestor(e.target.value)}
                  className="capitare-input bg-purple-50 border border-purple-300 text-purple-800 rounded-lg focus:ring-purple-500 focus:border-purple-500 transition-colors"
                >
                  <option value="demo">Demo</option>
                  <option value="pj_or_investor1">Investidor 1</option>
                  <option value="pj_or_investor2">Investidor 2</option>
                  <option value="pj_or_investor3">Investidor 3</option>
                  <option value="pj_or_investor4">Investidor 4</option>
                </select>
              </div>

              <button
                onClick={handleInvestFIDC}
                disabled={isProcessing || !contractFidcId}
                className="capitare-btn w-full"
              >
                {isProcessing ? "Processando..." : "Investir no FIDC"}
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mb-12">
          <div className="capitare-card">
            <div className="capitare-icon">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            </div>
            <h2 className="capitare-card-title">
              Solicitar Antecipação em Stablecoin
            </h2>

            <div className="space-y-4">
              <div>
                <label className="capitare-input-label">
                  Valor da Antecipação em Stablecoin
                </label>
                <input
                  type="number"
                  value={anticipationAmount === 0 ? "" : anticipationAmount}
                  onChange={(e) => {
                    const value = e.target.value.replace(/^0+(?=\d)/, "");
                    setAnticipationAmount(value === "" ? 0 : Number(value));
                  }}
                  className="capitare-input"
                  placeholder="500"
                />
              </div>

              <div>
                <label className="capitare-input-label">
                  Valor da Antecipação com Colateral
                </label>
                <input
                  type="number"
                  value={(anticipationAmount * 120) / 100}
                  className="capitare-input"
                  placeholder="500"
                  readOnly
                  style={{pointerEvents: 'none'}}
                />
              </div>

              <div>
                <label className="capitare-input-label">Tipo de Garantia</label>
                <select
                  value={guaranteeType}
                  onChange={(e) =>
                    setGuaranteeType(
                      e.target.value as "consignado" | "cartao" | "duplicata"
                    )
                  }
                  className="capitare-input"
                >
                  <option value="consignado">Soja</option>
                  <option value="cartao">Cartão</option>
                  <option value="duplicata">Duplicata</option>
                </select>
              </div>

              <button
                onClick={() => handleAnticipation(guaranteeType)}
                disabled={isProcessing || !contractFidcId}
                className="capitare-btn w-full"
              >
                {isProcessing
                  ? "Processando..."
                  : `Solicitar Antecipação (Mediante ${guaranteeType})`}
              </button>
            </div>
          </div>

          <div className="capitare-card">
            <div className="capitare-icon">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                />
              </svg>
            </div>
            <h2 className="capitare-card-title">Pagamento do Adquirente</h2>

            <div className="space-y-4">
              <div>
                <label className="capitare-input-label">
                  Valor do Pagamento
                </label>
                <input
                  type="number"
                  value={compensationValue}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/^0+(?=\d)/, "");
                    const numericValue = Number(raw);
                    const limit = receivableLimit ? formatBigInt(receivableLimit) : Infinity;
            
                    if (numericValue <= limit) {
                      setCompensationValue(raw); // Apenas define se for válido
                    }
                  }}
                  className="capitare-input"
                  placeholder="500"
                />
                {
                  receivableLimit &&
                  <span><p style={{marginTop: '10px'}}>Valor máximo de pagamento: <strong>{formatBigInt(receivableLimit)}</strong></p></span>
                }
              </div>
              <button
                onClick={handleCompensation}
                disabled={isProcessing || !contractFidcId || !compensationValue}
                className="capitare-btn w-full"
              >
                {isProcessing
                  ? "Processando..."
                  : "Processar Pagamento do Adquirente"}
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 mb-12">
          <div className="capitare-card">
            <div className="capitare-icon">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                />
              </svg>
            </div>
            <h2 className="capitare-card-title">
              Liquidação de Investimentos - Investimentos dentro do período de
              carência
            </h2>

            <div className="space-y-4">
              <button
                onClick={handleRedeem}
                disabled={isProcessing || !contractFidcId}
                className="capitare-btn w-full"
              >
                {isProcessing ? "Processando..." : "Liquidar"}
              </button>
            </div>
          </div>
        </div>

        <div className="capitare-card">
          <div className="flex justify-between items-center w-full mb-2">
            <h2 className="capitare-card-title">Registro de Operações</h2>
            <button
              onClick={clearLogs}
              className="capitare-btn-outline text-sm px-2 py-1"
            >
              Limpar Registros
            </button>
          </div>

          <div className="bg-gray-900 rounded-lg p-4 text-green-400 font-mono">
            <div className="h-[300px] sm:h-[500px] overflow-y-auto">
              {logs.length === 0 ? (
                <p className="text-gray-500">
                  No logs yet. Start operations to see transaction logs.
                </p>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className="mb-1 break-words">
                    &gt; {log}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
