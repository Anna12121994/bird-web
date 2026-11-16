
import { useEffect, useState } from "react";
import { BrowserProvider, Contract } from "ethers";
import "./App.css";

type Prediction = {
  species: string;
  confidence: number;
};

type Bird = {
  id: number;
  imageName: string;
  predictedSpecies: string;
  confidence: number;
  analysisDate: string;
  description: string;
  extraInfo: string;
};

type AnalyzeResponse = {
  savedBird: Bird;
  predictions: Prediction[];
};

const CONTRACT_ADDRESS =
  "0x5FbDB2315678afecb367f032d93F642f64180aa3";

const CONTRACT_ABI = [
  "function register() external payable",
  "function isRegistered(address user) external view returns (bool)",
];

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [history, setHistory] = useState<Bird[]>([]);
  const [loading, setLoading] = useState(false);

  const [walletAddress, setWalletAddress] = useState("");
  const [registered, setRegistered] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);

  const API_URL = "http://localhost:5000/api/Birds";
  const CRYPTO_API_URL = "http://localhost:5000/api/Crypto";

  async function loadHistory() {
    try {
      const response = await fetch(API_URL);
      const data = await response.json();
      setHistory(data);
    } catch (error) {
      console.log(error);
    }
  }

  useEffect(() => {
    loadHistory();
  }, []);

  async function checkRegistration(address: string) {
    try {
      const ethereum = (window as any).ethereum;

      if (!ethereum) {
        return false;
      }

      const provider = new BrowserProvider(ethereum);

      const contract = new Contract(
        CONTRACT_ADDRESS,
        CONTRACT_ABI,
        provider
      );

      const isRegistered = await contract.isRegistered(address);

      setRegistered(isRegistered);

      return isRegistered;
    } catch (error) {
      console.log(error);
      setRegistered(false);
      return false;
    }
  }

  async function connectWallet() {
    try {
      const ethereum = (window as any).ethereum;

      if (!ethereum) {
        alert("MetaMask не встановлено");
        return;
      }

      await ethereum.request({
        method: "wallet_requestPermissions",
        params: [
          {
            eth_accounts: {},
          },
        ],
      });

      const accounts = await ethereum.request({
        method: "eth_requestAccounts",
      });

      const address = accounts[0];

      setWalletAddress(address);

      await checkRegistration(address);
    } catch (error) {
      console.log(error);
      alert("Не вдалося підключити MetaMask");
    }
  }

  async function payRegistration() {
    try {
      const ethereum = (window as any).ethereum;

      if (!ethereum) {
        alert("MetaMask не встановлено");
        return;
      }

      if (!walletAddress) {
        alert("Спочатку підключіть MetaMask");
        return;
      }

      setPaymentLoading(true);

      const provider = new BrowserProvider(ethereum);
      const signer = await provider.getSigner();

      const contract = new Contract(
        CONTRACT_ADDRESS,
        CONTRACT_ABI,
        signer
      );

      const transaction = await contract.register({
        value: "1000000000000000",
      });

      await transaction.wait();

      const response = await fetch(
        `${ CRYPTO_API_URL } /register`,
{
    method: "POST",
        headers: {
        "Content-Type": "application/json",
          },
    body: JSON.stringify({
        walletAddress: walletAddress,
        transactionHash: transaction.hash,
    }),
        }
      );

if (!response.ok) {
    alert("Оплата пройшла, але не вдалося записати користувача в базу");
    return;
}

await checkRegistration(walletAddress);

alert("Реєстрація успішна!");
    } catch (error) {
    console.log(error);
    alert("Оплату скасовано або сталася помилка");
} finally {
    setPaymentLoading(false);
}
  }

async function analyzeImage() {
    if (!walletAddress) {
        alert("Спочатку підключіть MetaMask");
        return;
    }

    if (!registered) {
        alert("Спочатку потрібно оплатити реєстрацію");
        return;
    }

    if (!file) {
        alert("Оберіть фотографію");
        return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
        setLoading(true);

        const response = await fetch(API_URL + "/analyze", {
            method: "POST",
            body: formData,
        });

        if (!response.ok) {
            alert("Помилка аналізу");
            return;
        }

        const data: AnalyzeResponse = await response.json();

        setResult(data);

        await loadHistory();
    } catch (error) {
        console.log(error);
        alert("Не вдалося підключитися до сервера");
    } finally {
        setLoading(false);
    }
}

return (
    <div className="container">
        <h1>AI Bird Lab</h1>

        <p className="subtitle">
            Завантажте фотографію птаха для AI-аналізу
        </p>

        <div className="wallet-box">
            {!walletAddress ? (
                <button onClick={connectWallet}>
                    Підключити MetaMask
                </button>
            ) : (
                <>
                    <p>
                        <strong>Гаманець:</strong>{" "}
                        {walletAddress.slice(0, 6)}...
                        {walletAddress.slice(-4)}
                    </p>

                    <button onClick={connectWallet}>
                        Змінити акаунт
                    </button>

                    {registered ? (
                        <p className="wallet-success">
                             Доступ активний
                        </p>
                    ) : (
                        <>
                            <p className="wallet-error">
                                 Потрібна оплата реєстрації
                            </p>

                            <button
                                onClick={payRegistration}
                                disabled={paymentLoading}
                            >
                                {paymentLoading
                                    ? "Оплата..."
                                    : "Оплатити 0.001 ETH"}
                            </button>
                        </>
                    )}
                </>
            )}
        </div>

        <div className="upload-box">
            <input
                type="file"
                accept=".jpg,.jpeg,.png"
                onChange={(e) =>
                    setFile(e.target.files ? e.target.files[0] : null)
                }
            />

            <button
                onClick={analyzeImage}
                disabled={loading || !registered}
            >
                {loading ? "Аналіз..." : "Проаналізувати"}
            </button>
        </div>

        {result && (
            <div className="result">
                <h2>Результат аналізу</h2>

                <h3>{result.savedBird.predictedSpecies}</h3>

                <p>
                    Впевненість:{" "}
                    {(result.savedBird.confidence * 100).toFixed(2)}%
                </p>

                <h3>Top 3</h3>

                {result.predictions.map((prediction, index) => (
                    <div className="prediction" key={index}>
                        {index + 1}. {prediction.species} —{" "}
                        {(prediction.confidence * 100).toFixed(2)}%
                    </div>
                ))}
            </div>
        )}

        <div className="history">
            <h2>Історія аналізів</h2>

            {history.length === 0 && <p>Історія поки порожня.</p>}

            {history.map((bird) => (
                <div className="bird-card" key={bird.id}>
                    <h3>{bird.predictedSpecies}</h3>

                    <p>
                        <strong>Фото:</strong> {bird.imageName}
                    </p>

                    <p>
                        <strong>Впевненість:</strong>{" "}
                        {(bird.confidence * 100).toFixed(2)}%
                    </p>

                    <p>
                        <strong>Дата:</strong>{" "}
                        {new Date(bird.analysisDate).toLocaleString()}
                    </p>

                    <p>
                        <strong>Опис:</strong> {bird.description}
                    </p>
                </div>
            ))}
        </div>
    </div>
);
}

export default App;
