"use client";
import { useState } from "react";
import CapitareHeader from "@/components/CapitareHeader";
import { useContract } from "@/hooks/useContract";

export default function ManagerPage() {
  const {
    onGetFIDC,
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
  } = useContract();
  const [investAmount, setInvestAmount] = useState(1000);
  const [anticipationAmount, setAnticipationAmount] = useState(500);
  const [fidc, setFidc] = useState<any>(null);

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

        <div className="mb-8">
          <div className="capitare-card">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-700 mb-2 flex items-center justify-between w-full">
                  Available Balances - FIDC ID: {fidcId || "N/A"}{" "}
                  <button
                    onClick={updateBalances}
                    className="capitare-btn-outline px-4 py-2 flex items-center gap-2"
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

                <div className="grid grid-cols-2 gap-4">
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

        <div className="grid grid-cols-2 gap-8 mb-12">
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
            <h2 className="capitare-card-title">Get FIDC</h2>

            <div className="space-y-4">
              <label className="capitare-input-label"> FIDC ID </label>
              <input
                type="number"
                value={fidc!}
                onChange={(e) => setFidc(Number(e.target.value))}
                className="capitare-input"
                placeholder="1"
              />
              <button
                onClick={() => onGetFIDC(fidc!)}
                disabled={isProcessing}
                className="capitare-btn w-full"
              >
                {isProcessing ? "Processing..." : "Get FIDC"}
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

          {/* Initialize FIDC Card */}
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
                onClick={onInitializeFIDC}
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

          {/* Invest in FIDC Card */}
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
                onClick={() => {
                  if (fidcId && investAmount > 0) {
                    onInvestFIDC(fidcId, investAmount);
                  }
                }}
                disabled={isProcessing || !fidcId}
                className="capitare-btn w-full"
              >
                {isProcessing ? "Processing..." : "Invest in FIDC"}
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
                onClick={() => {
                  if (fidcId && anticipationAmount > 0) {
                    onAnticipation(fidcId, anticipationAmount);
                  }
                }}
                disabled={isProcessing || !fidcId}
                className="capitare-btn w-full"
              >
                {isProcessing ? "Processing..." : "Process Anticipation"}
              </button>
            </div>
          </div>

          {/* Compensation Card */}
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
                onClick={() => {
                  if (fidcId) {
                    onCompensation(fidcId);
                  }
                }}
                disabled={isProcessing || !fidcId}
                className="capitare-btn w-full"
              >
                {isProcessing
                  ? "Processing..."
                  : "Process Compensation Payment"}
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
                  d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                />
              </svg>
            </div>
            <h2 className="capitare-card-title">Redeem</h2>

            <div className="space-y-4">
              <button
                onClick={() => {
                  if (fidcId) {
                    onRedeem(fidcId);
                  }
                }}
                disabled={isProcessing || !fidcId}
                className="capitare-btn w-full"
              >
                {isProcessing ? "Processing..." : "Process Redemption"}
              </button>
            </div>
          </div>
        </div>

        {/* Transaction and Logs Card */}
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
                d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"
              />
            </svg>
          </div>
          <div className="flex justify-between items-center w-full mb-2">
            <h2 className="capitare-card-title">Transaction Logs</h2>
            <button
              onClick={clearLogs}
              className="capitare-btn-outline text-sm px-2 py-1"
            >
              Clear Logs
            </button>
          </div>

          <div className="bg-gray-900 rounded-lg p-4 text-green-400 font-mono">
            <div className="h-[500px] overflow-y-auto">
              {logs.length === 0 ? (
                <p className="text-gray-500">
                  No logs yet. Start operations to see transaction logs.
                </p>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className="mb-1">
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
