"use client";
import { useState, useRef } from "react";
import CapitareHeader from "@/components/CapitareHeader";
import { useContract } from "@/hooks/useContract";
import { EventData } from "@/interfaces";
import { TransactionStatus } from "@/components/TransactionStatus";

export default function ManagerPage() {
  const {
    onInitializeFIDC,
    onInvestFIDC,
    onAnticipation,
    onCompensation,
    onRedeem,
    updateBalances,
    fidcId,
    stablecoinBalance,
    receivablesBalance,
    logs,
    clearLogs,
    isProcessing,
    debugTransactionEvents,
    onGetFIDC,
    onGetAllInvestors,
    txHash,
  } = useContract();

  const [currentOperation, setCurrentOperation] = useState<string>("");
  const [currentEvents, setCurrentEvents] = useState<EventData[]>([]);
  const [investors, setInvestors] = useState<string[]>([]);
  const [showInvestors, setShowInvestors] = useState<boolean>(false);
  // Estado para controlar se o popup deve ser aberto forçadamente
  const [forceOpenModal, setForceOpenModal] = useState<boolean>(false);

  const [investAmount, setInvestAmount] = useState(1000);
  const [anticipationAmount, setAnticipationAmount] = useState(500);
  const [debugTxHash, setDebugTxHash] = useState("");
  const [fidcIdInput, setFidcIdInput] = useState("");

  const handleInitializeFIDC = async () => {
    try {
      setCurrentOperation("Inicialização de FIDC");
      setCurrentEvents([]);
      setShowInvestors(false);
      const result = await onInitializeFIDC();
      setCurrentEvents(result.events || []);
    } catch (error) {
      console.error("Erro ao inicializar FIDC:", error);
    }
  };

  const handleInvestFIDC = async () => {
    if (!fidcId || investAmount <= 0) return;

    try {
      setCurrentOperation("Investimento");
      setCurrentEvents([]);
      setShowInvestors(false);
      const result = await onInvestFIDC(fidcId, investAmount);
      setCurrentEvents([
        ...(result.approveEvents || []),
        ...(result.investEvents || []),
      ]);
    } catch (error) {
      console.error("Erro ao investir no FIDC:", error);
    }
  };

  const handleAnticipation = async () => {
    if (!fidcId || anticipationAmount <= 0) return;

    try {
      setCurrentOperation("Antecipação");
      setCurrentEvents([]);
      setShowInvestors(false);
      const result = await onAnticipation(fidcId, anticipationAmount);
      setCurrentEvents(result.events || []);
    } catch (error) {
      console.error("Erro na antecipação:", error);
    }
  };

  const handleCompensation = async () => {
    if (!fidcId) return;

    try {
      setCurrentOperation("Compensação");
      setCurrentEvents([]);
      setShowInvestors(false);
      const result = await onCompensation(fidcId);
      setCurrentEvents(result.events || []);
    } catch (error) {
      console.error("Erro na compensação:", error);
    }
  };

  const handleRedeem = async () => {
    if (!fidcId) return;

    try {
      setCurrentOperation("Resgate");
      setCurrentEvents([]);
      setShowInvestors(false);
      const result = await onRedeem(fidcId);
      setCurrentEvents(result.events || []);
    } catch (error) {
      console.error("Erro no resgate:", error);
    }
  };

  const handleDebugTransaction = async () => {
    if (!debugTxHash) return;

    try {
      setCurrentOperation("Depuração de Transação");
      setCurrentEvents([]);
      setShowInvestors(false);
      const result = await debugTransactionEvents(debugTxHash);
      if (result && result.events) {
        setCurrentEvents(result.events || []);
      }
    } catch (error) {
      console.error("Erro ao depurar transação:", error);
    }
  };

  const handleGetAllInvestors = async () => {
    if (!fidcId) return;

    try {
      setCurrentOperation("Lista de Investidores");
      setCurrentEvents([]);
      setShowInvestors(true);
      // Força a abertura do modal
      setForceOpenModal(true);

      const result = await onGetAllInvestors(fidcId);
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

  return (
    <div className="capitare-gradient-bg min-h-screen pt-20 pb-12">
      <CapitareHeader />

      <div className="capitare-container mx-auto px-4">
        <h1 className="capitare-section-title text-center mb-12">
          FIDC Management Platform
        </h1>

        <p className="text-center text-white mb-8 max-w-3xl mx-auto">
          Capitare offers a simple and intuitive process for investing in high
          potential opportunities. See below the steps to start investing with
          Capitare.
        </p>

        {/* Um único componente de status para todas as transações */}
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
              <div className="flex-1 w-full">
                <h3 className="text-lg font-semibold text-gray-700 mb-2 flex flex-col sm:flex-row sm:items-center sm:justify-between w-full gap-2">
                  <span>Available Balances - FIDC ID: {fidcId || "N/A"}</span>
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
                    Refresh Balances
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
                      Stablecoin
                    </div>
                    <div className="text-2xl font-bold text-blue-800">
                      {Number(stablecoinBalance).toLocaleString()} Stablecoin
                    </div>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <div className="text-sm text-purple-600 font-medium mb-1">
                      Receivables
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
              Debug Tools
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-gray-600 mb-2">
                  Depurar Transação
                </h4>
                <div className="flex flex-col sm:flex-row gap-2 mb-4">
                  <input
                    type="text"
                    value={debugTxHash}
                    onChange={(e) => setDebugTxHash(e.target.value)}
                    placeholder="Digite o hash da transação"
                    className="capitare-input flex-1"
                  />
                  <button
                    onClick={handleDebugTransaction}
                    disabled={isProcessing || !debugTxHash}
                    className="capitare-btn mt-2 sm:mt-0"
                  >
                    Depurar
                  </button>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-600 mb-2">
                  Carregar FIDC Existente
                </h4>
                <div className="flex flex-col sm:flex-row gap-2 mb-4">
                  <input
                    type="number"
                    value={fidcIdInput}
                    onChange={(e) => setFidcIdInput(e.target.value)}
                    placeholder="Digite o ID do FIDC"
                    className="capitare-input flex-1"
                  />
                  <button
                    onClick={() => {
                      if (fidcIdInput) {
                        onGetFIDC(Number(fidcIdInput));
                      }
                    }}
                    disabled={isProcessing || !fidcIdInput}
                    className="capitare-btn mt-2 sm:mt-0"
                  >
                    Carregar
                  </button>
                </div>
              </div>
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
            <h2 className="capitare-card-title">Get All Investors</h2>

            <div className="space-y-4">
              <button
                onClick={handleGetAllInvestors}
                disabled={isProcessing || !fidcId}
                className="capitare-btn w-full"
              >
                {isProcessing ? "Processing..." : "Get All Investors"}
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
            <h2 className="capitare-card-title">Initialize FIDC</h2>

            <div className="space-y-4">
              <button
                onClick={handleInitializeFIDC}
                disabled={isProcessing}
                className="capitare-btn w-full"
              >
                {isProcessing ? "Processing..." : "Initialize New FIDC"}
              </button>

              {fidcId && (
                <div className="bg-green-50 border-l-4 border-green-400 p-3 mt-3">
                  <p className="text-sm text-green-700">
                    <span className="font-semibold">FIDC Active</span> - ID:{" "}
                    {fidcId}
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
            <h2 className="capitare-card-title">Invest in FIDC</h2>

            <div className="space-y-4">
              <div>
                <label className="capitare-input-label">
                  Investment Amount
                </label>
                <input
                  type="number"
                  value={investAmount}
                  onChange={(e) => setInvestAmount(Number(e.target.value))}
                  className="capitare-input"
                  placeholder="1000"
                />
              </div>

              <button
                onClick={handleInvestFIDC}
                disabled={isProcessing || !fidcId}
                className="capitare-btn w-full"
              >
                {isProcessing ? "Processing..." : "Invest in FIDC"}
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
            <h2 className="capitare-card-title">Anticipation</h2>

            <div className="space-y-4">
              <div>
                <label className="capitare-input-label">
                  Anticipation Amount
                </label>
                <input
                  type="number"
                  value={anticipationAmount}
                  onChange={(e) =>
                    setAnticipationAmount(Number(e.target.value))
                  }
                  className="capitare-input"
                  placeholder="500"
                />
              </div>

              <button
                onClick={handleAnticipation}
                disabled={isProcessing || !fidcId}
                className="capitare-btn w-full"
              >
                {isProcessing ? "Processing..." : "Liquidation"}
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
            <h2 className="capitare-card-title">Compensation Payment</h2>

            <div className="space-y-4">
              <button
                onClick={handleCompensation}
                disabled={isProcessing || !fidcId}
                className="capitare-btn w-full"
              >
                {isProcessing
                  ? "Processing..."
                  : "Process Compensation Payment"}
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
            <h2 className="capitare-card-title">Redeem</h2>

            <div className="space-y-4">
              <button
                onClick={handleRedeem}
                disabled={isProcessing || !fidcId}
                className="capitare-btn w-full"
              >
                {isProcessing ? "Processing..." : "Process Redemption"}
              </button>
            </div>
          </div>
        </div>

        <div className="capitare-card">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center w-full mb-2 gap-2">
            <h2 className="capitare-card-title">Transaction Logs</h2>
            <button
              onClick={clearLogs}
              className="capitare-btn-outline text-sm px-2 py-1"
            >
              Clear Logs
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
