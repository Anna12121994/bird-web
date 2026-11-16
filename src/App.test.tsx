
// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import App from "./App";

// Імітуємо роботу смартконтракту
const { checkMock, registerMock } = vi.hoisted(() => ({
  checkMock: vi.fn(),
  registerMock: vi.fn(),
}));

vi.mock("ethers", () => ({
  BrowserProvider: class {
    async getSigner() {
      return {};
    }
  },
  Contract: class {
    isRegistered = checkMock;
    register = registerMock;
  },
}));

const WALLET = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

const mockFetch = vi.fn();

const testBird = {
  id: 1,
  imageName: "bird.jpg",
  predictedSpecies: "EAGLE",
  confidence: 0.95,
  analysisDate: "2026-11-14T12:00:00Z",
  description: "Тестовий птах",
  extraInfo: "Тест",
};

beforeEach(() => {
  checkMock.mockReset();
  registerMock.mockReset();
  mockFetch.mockReset();

  checkMock.mockResolvedValue(true);

  registerMock.mockResolvedValue({
    hash: "0xabc",
    wait: vi.fn().mockResolvedValue(undefined),
  });

  mockFetch.mockImplementation(async () => ({
    ok: true,
    json: async () => [],
  }));

  vi.stubGlobal("fetch", mockFetch);

  vi.stubGlobal("ethereum", {
    request: vi.fn(async ({ method }: { method: string }) => {
      if (method === "eth_requestAccounts") {
        return [WALLET];
      }
      return [];
    }),
  });

  vi.spyOn(window, "alert").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("AI Bird Lab — Web Tests", () => {

  // 1
  it("Відображає назву застосунку", () => {
    render(<App />);

    expect(screen.getByText("AI Bird Lab")).toBeInTheDocument();
  });

  // 2
  it("Показує порожню історію", () => {
    render(<App />);

    expect(
      screen.getByText("Історія поки порожня.")
    ).toBeInTheDocument();
  });

  // 3
  it("Завантажує історію аналізів", async () => {
    mockFetch.mockImplementation(async () => ({
      ok: true,
      json: async () => [testBird],
    }));

    render(<App />);

    expect(
      await screen.findByText("EAGLE")
    ).toBeInTheDocument();

    expect(screen.getByText("bird.jpg")).toBeInTheDocument();
  });

  // 4
  it("Блокує аналіз без реєстрації", () => {
    render(<App />);

    expect(
      screen.getByRole("button", { name: "Проаналізувати" })
    ).toBeDisabled();
  });

  //  5
  it("Показує помилку без MetaMask", async () => {
    vi.stubGlobal("ethereum", undefined);

    render(<App />);

    fireEvent.click(
      screen.getByRole("button", { name: "Підключити MetaMask" })
    );

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith(
        "MetaMask не встановлено"
      );
    });
  });

  // 6
  it("Підключає зареєстрований гаманець", async () => {
    render(<App />);

    fireEvent.click(
      screen.getByRole("button", { name: "Підключити MetaMask" })
    );

    expect(
      await screen.findByText(/Доступ активний/)
    ).toBeInTheDocument();
  });

  // 7
  it("Показує оплату для незареєстрованого гаманця", async () => {
    checkMock.mockResolvedValue(false);

    render(<App />);

    fireEvent.click(
      screen.getByRole("button", { name: "Підключити MetaMask" })
    );

    expect(
      await screen.findByRole("button", { name: "Оплатити 0.001 ETH" })
    ).toBeInTheDocument();
  });

  // 8
  it("Відправляє фото та показує результат AI-аналізу", async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes("/analyze")) {
        return {
          ok: true,
          json: async () => ({
            savedBird: testBird,
            predictions: [
              { species: "EAGLE", confidence: 0.95 },
              { species: "HAWK", confidence: 0.04 },
              { species: "FALCON", confidence: 0.01 },
            ],
          }),
        };
      }

      return {
        ok: true,
        json: async () => [],
      };
    });

    render(<App />);

    fireEvent.click(
      screen.getByRole("button", { name: "Підключити MetaMask" })
    );

    await screen.findByText(/Доступ активний/);

    const fileInput = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;

    const file = new File(
      ["test image"],
      "bird.jpg",
      { type: "image/jpeg" }
    );

    fireEvent.change(fileInput, {
      target: { files: [file] },
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Проаналізувати" })
    );

    expect(
      await screen.findByText("Результат аналізу")
    ).toBeInTheDocument();

    expect(screen.getByText("EAGLE")).toBeInTheDocument();
    expect(screen.getByText("HAWK", { exact: false })).toBeInTheDocument();

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:5000/api/Birds/analyze",
        expect.objectContaining({
          method: "POST",
          body: expect.any(FormData),
        })
      );
    });
  });
});
