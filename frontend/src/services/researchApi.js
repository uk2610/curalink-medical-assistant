import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const client = axios.create({
  baseURL: API_BASE,
  timeout: 120000
});

export async function submitResearchQuery(payload) {
  const { data } = await client.post("/api/research", payload);
  return data;
}
