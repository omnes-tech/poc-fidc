import { EventData } from "@/interfaces";
import { useState, useEffect } from "react";
import { ethers } from "ethers";

// Função utilitária para formatar valores de eventos para exibição
function formatEventValue(value: any): string {
  if (
    typeof value === "bigint" ||
    (typeof value === "string" && value.match(/^\d+$/))
  ) {
    // Tenta formatar como ether se for um valor numérico grande
    try {
      const num = BigInt(value.toString());
      // Se for um número grande (acima de 10^9), provavelmente é um valor em wei
      if (num > BigInt("1000000000000000")) {
        return `${ethers.formatEther(num)} ETH`;
      }
      return value.toString();
    } catch (e) {
      return value.toString();
    }
  } else if (value && typeof value === "object" && value._isBigNumber) {
    // Para compatibilidade com algumas versões do ethers
    return ethers.formatEther(value);
  } else if (typeof value === "boolean") {
    return value ? "Sim" : "Não";
  } else if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

// Função auxiliar para converter objetos BigInt em strings para exibição
function convertBigIntToString(obj: any): any {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === "bigint") {
    return obj.toString();
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => convertBigIntToString(item));
  }

  if (typeof obj === "object") {
    const result: Record<string, any> = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        result[key] = convertBigIntToString(obj[key]);
      }
    }
    return result;
  }

  return obj;
}

// Função para extrair e formatar o valor principal do evento
function getEventDisplayValue(event: EventData): string {
  if (!event.args) return "N/A";

  // Buscar valores relevantes com base no tipo de evento
  switch (event.name) {
    case "FIDCCreated":
      return `FIDC ID: ${event.args[0]} | Gestor: ${event.args[1].slice(
        0,
        6
      )}...${event.args[1].slice(
        -4
      )} | Recebíveis: ${event.args[2].slice()}...${event.args[1].slice(
        -4
      )} | Receivable: ${event.args[2].slice(0, 6)}...${event.args[2].slice(
        -4
      )}`;
    case "Investment":
      return `Amount: ${ethers.formatEther(event.args[1] || "0")} Stablecoin`;
    case "QuotasMinted":
      return `Quotas: ${ethers.formatEther(event.args[1] || "0")}`;
    case "Approval":
      try {
        return `Valor: ${ethers.formatEther(event.args[2] || "0")} tokens`;
      } catch (e) {
        return `Valor: ${event.args[2] || "0"}`;
      }
    case "Transfer":
      try {
        return `Valor: ${ethers.formatEther(event.args[2] || "0")} tokens`;
      } catch (e) {
        return `Valor: ${event.args[2] || "0"}`;
      }
    case "CompensationProcessed":
      return `FIDC ID: ${
        event.args[0]
      } | Pagamento de Recebíveis - Adquirente: ${event.args[1].slice(
        0,
        6
      )}...${event.args[1].slice(-4)} | Valor: ${ethers.formatEther(
        event.args[2]
      )} Stablecoin`;
    case "Anticipation":
      return `FIDC ID: ${
        event.args[0]
      } | Antecipação de Recebíveis - PJ: ${event.args[1].slice(
        0,
        6
      )}...${event.args[1].slice(-4)} | Valor: ${ethers.formatEther(
        event.args[2]
      )} Stablecoin | Colateral: ${ethers.formatEther(event.args[4])}`;
    case "FIDCRedemption":
      const investmentDate = new Date(
        Number(event.args[8]) * 1000
      ).toLocaleString();
      const redemptionDate = new Date(
        Number(event.args[9]) * 1000
      ).toLocaleString();
      return `FIDC ID: ${event.args[0]} | Investidor: ${event.args[1].slice(
        0,
        6
      )}...${event.args[1].slice(-4)} | Valor: ${ethers.formatEther(
        event.args[2]
      )} | Lucro Líquido: ${ethers.formatEther(event.args[4])}`;
    case "NewInvestmentRegistered":
      return `Investidor: ${event.args[0].slice(0, 6)}...${event.args[0].slice(
        -4
      )} | FIDC ID: ${event.args[1]} | Valor Investido: ${ethers.formatEther(
        event.args[3]
      )} Stablecoin`;
    default:
      // Para eventos desconhecidos, mostrar primeiro argumento não numérico
      const entries = Object.entries(event.args);
      const normalEntries = entries.filter(([key]) => isNaN(Number(key)));

      for (const [key, value] of normalEntries) {
        if (value && typeof value !== "object") {
          return `${key}: ${value.toString()}`;
        }
      }

      // Se não encontrar um valor simples, mostrar o primeiro argumento disponível
      if (entries.length > 0) {
        const [index, value] = entries[0];
        if (typeof value === "object") {
          return "Objeto complexo (expandir para ver)";
        }
        return `${index}: ${value?.toString() || ""}`;
      }

      return "Detalhes disponíveis ao expandir";
  }
}

function EventDetails({ event }: { event: EventData }) {
  switch (event.name) {
    case "FIDCCreated":
      return (
        <div className="bg-blue-50 p-4 rounded-lg space-y-2">
          <div className="font-medium text-blue-800 mb-3">
            FIDC Created Details:
          </div>
          <div className="grid grid-cols-1 gap-3">
            <div className="flex flex-col">
              <span className="text-sm text-gray-600">FIDC ID:</span>
              <span className="font-mono text-blue-700 bg-blue-50 px-2 py-1 rounded">
                {event.args[0].toString()}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm text-gray-600">Manager Address:</span>
              <a
                href={`https://holesky.etherscan.io/address/${event.args[1]}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-1 rounded truncate"
              >
                {event.args[1]}
              </a>
            </div>
            <div className="flex flex-col">
              <span className="text-sm text-gray-600">
                Receivable Contract:
              </span>
              <a
                href={`https://holesky.etherscan.io/address/${event.args[2]}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-1 rounded truncate"
              >
                {event.args[2]}
              </a>
            </div>
          </div>
        </div>
      );

    case "NewInvestmentRegistered":
      return (
        <div className="bg-green-50 p-4 rounded-lg space-y-2">
          <div className="font-medium text-green-800 mb-3">
            Detalhes da Investimento:
          </div>
          <div className="grid grid-cols-1 gap-3">
            <div className="flex flex-col">
              <span className="text-sm text-gray-600">
                Endereço do Investidor:
              </span>
              <a
                href={`https://holesky.etherscan.io/address/${event.args[0]}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-1 rounded truncate"
              >
                {event.args[0]}
              </a>
            </div>
            <div className="flex flex-col">
              <span className="text-sm text-gray-600">FIDC ID:</span>
              <span className="font-mono text-green-700 bg-green-50 px-2 py-1 rounded">
                {event.args[1].toString()}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm text-gray-600">
                ID da Posição de Investimento:
              </span>
              <span className="font-mono text-green-700 bg-green-50 px-2 py-1 rounded">
                {event.args[2].toString()}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm text-gray-600">Valor Investido:</span>
              <span className="font-mono text-green-700 bg-green-50 px-2 py-1 rounded">
                {ethers.formatEther(event.args[3])} Stablecoin
              </span>
            </div>
          </div>
        </div>
      );

    case "CompensationProcessed":
      return (
        <div className="bg-orange-50 p-4 rounded-lg space-y-2">
          <div className="font-medium text-orange-800 mb-3">
            Detalhes do Pagamento de Recebíveis
          </div>
          <div className="grid grid-cols-1 gap-3">
            <div className="flex flex-col">
              <span className="text-sm text-gray-600">ID do FIDC:</span>
              <span className="font-mono text-orange-700 bg-orange-50 px-2 py-1 rounded">
                {event.args[0].toString()}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm text-gray-600">
                Endereço do Adquirente:
              </span>
              <a
                href={`https://holesky.etherscan.io/address/${event.args[1]}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-1 rounded truncate"
              >
                {event.args[1]}
              </a>
            </div>
            <div className="flex flex-col">
              <span className="text-sm text-gray-600">Valor do Pagamento:</span>
              <span className="font-mono text-orange-700 bg-orange-50 px-2 py-1 rounded">
                {ethers.formatEther(event.args[2])} Stablecoin
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm text-gray-600">Cofre do FIDC:</span>
              <a
                href={`https://holesky.etherscan.io/address/${event.args[3]}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-1 rounded truncate"
              >
                {event.args[3]}
              </a>
            </div>
          </div>
        </div>
      );

    case "Anticipation":
      return (
        <div className="bg-purple-50 p-4 rounded-lg space-y-2">
          <div className="font-medium text-purple-800 mb-3">
            Detalhes da Antecipação de Recebíveis
          </div>
          <div className="grid grid-cols-1 gap-3">
            <div className="flex flex-col">
              <span className="text-sm text-gray-600">ID do FIDC:</span>
              <span className="font-mono text-purple-700 bg-purple-50 px-2 py-1 rounded">
                {event.args[0].toString()}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm text-gray-600">Endereço da PJ:</span>
              <a
                href={`https://holesky.etherscan.io/address/${event.args[1]}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-1 rounded truncate"
              >
                {event.args[1]}
              </a>
            </div>
            <div className="flex flex-col">
              <span className="text-sm text-gray-600">Valor Solicitado:</span>
              <span className="font-mono text-purple-700 bg-purple-50 px-2 py-1 rounded">
                {ethers.formatEther(event.args[2])} Stablecoin
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm text-gray-600">
                Contrato do Colateral:
              </span>
              <a
                href={`https://holesky.etherscan.io/address/${event.args[3]}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-1 rounded truncate"
              >
                {event.args[3]}
              </a>
            </div>
            <div className="flex flex-col">
              <span className="text-sm text-gray-600">Valor do Colateral:</span>
              <span className="font-mono text-purple-700 bg-purple-50 px-2 py-1 rounded">
                {ethers.formatEther(event.args[4])} Colateral
              </span>
            </div>
          </div>
        </div>
      );

    case "FIDCRedemption":
      return (
        <div className="bg-red-50 p-4 rounded-lg space-y-2">
          <div className="font-medium text-red-800 mb-3">
            Detalhes da Liquidação de Recebíveis
          </div>
          <div className="grid grid-cols-1 gap-3">
            <div className="flex flex-col">
              <span className="text-sm text-gray-600">ID do FIDC:</span>
              <span className="font-mono text-red-700 bg-red-50 px-2 py-1 rounded">
                {event.args[0].toString()}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm text-gray-600">
                Endereço do Investidor:
              </span>
              <a
                href={`https://holesky.etherscan.io/address/${event.args[1]}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-1 rounded truncate"
              >
                {event.args[1]}
              </a>
            </div>
            <div className="flex flex-col">
              <span className="text-sm text-gray-600">
                Valor do Investimento:
              </span>
              <span className="font-mono text-red-700 bg-red-50 px-2 py-1 rounded">
                {ethers.formatEther(event.args[2])} Stablecoin
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm text-gray-600">
                Rendimento Bruto (Com Taxa):
              </span>
              <span className="font-mono text-red-700 bg-red-50 px-2 py-1 rounded">
                {ethers.formatEther(event.args[3])} Stablecoin
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm text-gray-600">
                Rendimento Líquido (Para o Investidor):
              </span>
              <span className="font-mono text-red-700 bg-red-50 px-2 py-1 rounded">
                {ethers.formatEther(event.args[4])} Stablecoin
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm text-gray-600">Taxa do Gestor:</span>
              <span className="font-mono text-red-700 bg-red-50 px-2 py-1 rounded">
                {ethers.formatEther(event.args[5])} Stablecoin
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm text-gray-600">Cotas Queimadas:</span>
              <span className="font-mono text-red-700 bg-red-50 px-2 py-1 rounded">
                {ethers.formatEther(event.args[6])} Cotas
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm text-gray-600">Investidor Sênior:</span>
              <span className="font-mono text-red-700 bg-red-50 px-2 py-1 rounded">
                {event.args[7] ? "Sim" : "Não"}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm text-gray-600">
                Data do Investimento:
              </span>
              <span className="font-mono text-red-700 bg-red-50 px-2 py-1 rounded">
                {new Date(Number(event.args[8]) * 1000).toLocaleString()}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm text-gray-600">Data do Resgate:</span>
              <span className="font-mono text-red-700 bg-red-50 px-2 py-1 rounded">
                {new Date(Number(event.args[9]) * 1000).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      );

    default:
      return (
        <div className="grid grid-cols-1 gap-2">
          <div className="bg-slate-700 p-2 rounded mb-3 text-xs text-white">
            Event Arguments:
          </div>
          {Object.entries(event.args || {}).map(([key, value]) => (
            <div
              key={key}
              className="flex flex-col sm:flex-row sm:items-center py-2 border-b border-gray-100"
            >
              <span className="font-mono text-sm text-gray-500 sm:w-1/3 mb-1 sm:mb-0">
                {key}:
              </span>
              <span className="font-mono text-sm text-gray-700 break-all bg-gray-50 p-2 rounded">
                {typeof value === "bigint"
                  ? formatEventValue(value)
                  : typeof value === "object"
                  ? JSON.stringify(convertBigIntToString(value))
                  : String(value)}
              </span>
            </div>
          ))}
        </div>
      );
  }
}

export function TransactionStatus({
  hash,
  isProcessing,
  operation,
  events = [],
  investors = [],
  forceOpen = false,
  onModalClose,
  fidcId,
}: {
  hash: string | null;
  isProcessing: boolean;
  operation: string;
  events?: EventData[];
  investors?: string[];
  forceOpen?: boolean;
  onModalClose?: () => void;
  fidcId?: number;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedEvent, setExpandedEvent] = useState<number | null>(null);
  const etherscanUrl = hash ? `https://holesky.etherscan.io/tx/${hash}` : "";

  useEffect(() => {
    if (isProcessing || forceOpen) {
      setIsOpen(true);
    }
  }, [isProcessing, forceOpen]);

  // Garantir que temos um array de eventos válido
  const processedEvents = events || [];

  // Debug para ajudar a verificar a estrutura dos eventos
  console.log(
    "Eventos recebidos:",
    JSON.stringify(convertBigIntToString(processedEvents))
  );

  if (!hash && !isProcessing && !investors.length) return null;

  // Função para fechar o modal e notificar o componente pai
  const handleClose = () => {
    setIsOpen(false);
    if (onModalClose) {
      onModalClose();
    }
  };

  return (
    <>
      {(hash || investors.length > 0) && !isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-4 right-4 px-4 py-2 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 flex items-center z-50"
        >
          <svg
            className="w-5 h-5 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          {investors.length > 0 ? "Ver investidores" : "Ver transação"}
        </button>
      )}

      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="bg-blue-600 px-4 py-3 flex justify-between items-center text-white">
              <h3 className="text-lg font-medium">
                {isProcessing
                  ? `Executando ${operation}...`
                  : `${operation} - Concluído`}
              </h3>
              <button
                onClick={handleClose}
                className="text-white hover:text-gray-200 focus:outline-none"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-grow">
              {isProcessing && (
                <div className="flex flex-col items-center justify-center py-6">
                  <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mb-4"></div>
                  <p className="text-gray-600">
                    Executando transação na blockchain...
                  </p>
                </div>
              )}

              {/* Exibição de investidores */}
              {!isProcessing && operation === "Lista de Investidores" && (
                <div>
                  <h4 className="font-medium text-gray-700 mb-4">
                    Investidores do FIDC {fidcId}:
                  </h4>
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    {!investors || investors.length === 0 ? (
                      <p className="text-gray-500 italic">
                        Nenhum investidor encontrado para o FIDC {fidcId}
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {investors.map((investor, index) => (
                          <div
                            key={index}
                            className="flex items-center py-2 border-b border-gray-200"
                          >
                            <div className="bg-blue-100 text-blue-800 font-bold rounded-full w-8 h-8 flex items-center justify-center mr-3">
                              {index + 1}
                            </div>
                            <a
                              href={`https://holesky.etherscan.io/address/${investor}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 hover:underline font-mono break-all text-sm"
                            >
                              {investor}
                            </a>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Exibição de eventos de transação */}
              {!isProcessing && operation !== "Lista de Investidores" && (
                <>
                  {hash && (
                    <div className="mb-6">
                      <h4 className="font-medium text-gray-700 mb-2">
                        Hash da Transação:
                      </h4>
                      <a
                        href={`https://holesky.etherscan.io/tx/${hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 hover:underline text-sm break-all p-3 bg-blue-50 rounded flex items-center"
                      >
                        <span className="flex-grow">{hash}</span>
                        <svg
                          className="w-5 h-5 ml-2 flex-shrink-0"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                          />
                        </svg>
                      </a>
                    </div>
                  )}

                  {processedEvents.length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-700 mb-2">
                        Eventos Emitidos ({processedEvents.length}):
                      </h4>
                      <div className="space-y-3">
                        {processedEvents.map((event, index) => (
                          <div
                            key={index}
                            className={`border ${
                              expandedEvent === index
                                ? "border-blue-300 bg-blue-50"
                                : "border-gray-200"
                            } rounded-lg overflow-hidden`}
                          >
                            <div
                              className={`p-3 cursor-pointer flex items-center justify-between ${
                                expandedEvent === index
                                  ? "bg-blue-100"
                                  : "bg-gray-50 hover:bg-gray-100"
                              }`}
                              onClick={() =>
                                setExpandedEvent(
                                  expandedEvent === index ? null : index
                                )
                              }
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center w-full">
                                <span className="font-medium text-gray-800 sm:mr-4 mb-1 sm:mb-0 sm:w-1/3">
                                  {event.name}
                                </span>
                                <span className="text-gray-600 text-sm sm:w-2/3">
                                  {getEventDisplayValue(event)}
                                </span>
                              </div>
                              <svg
                                className={`w-5 h-5 text-gray-600 transform transition-transform flex-shrink-0 ml-2 ${
                                  expandedEvent === index ? "rotate-180" : ""
                                }`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 9l-7 7-7-7"
                                />
                              </svg>
                            </div>

                            {expandedEvent === index && (
                              <div className="p-4 border-t border-gray-200">
                                <EventDetails event={event} />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {processedEvents.length === 0 && (
                    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                      <div className="flex">
                        <div className="flex-shrink-0">
                          <svg
                            className="h-5 w-5 text-yellow-400"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path
                              fillRule="evenodd"
                              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <p className="text-sm text-yellow-700">
                            Nenhum evento detectado nesta transação.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="bg-gray-50 px-4 py-3 flex justify-end">
              {hash && operation !== "Lista de Investidores" && (
                <a
                  href={`https://holesky.etherscan.io/tx/${hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm leading-5 font-medium rounded-md text-gray-700 bg-white hover:text-gray-500 focus:outline-none focus:border-blue-300 focus:shadow-outline-blue active:text-gray-800 active:bg-gray-50 transition ease-in-out duration-150 mr-3"
                >
                  Ver no Etherscan
                </a>
              )}
              <button
                onClick={handleClose}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm leading-5 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-500 focus:outline-none focus:border-blue-700 focus:shadow-outline-blue active:bg-blue-700 transition ease-in-out duration-150"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
