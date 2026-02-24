import { Redis } from "@upstash/redis";

/**
 * Vercel KV (Upstash Redis) 연결
 * - 서버리스 안전
 * - 재사용 가능
 * - 환경변수 없으면 자동 fallback
 */

let redis: Redis | null = null;

if (
  process.env.KV_REST_API_URL &&
  process.env.KV_REST_API_TOKEN
) {
  redis = new Redis({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
  });
} else {
  console.warn("⚠️ Redis 환경변수가 없습니다. 캐시 비활성화됨.");
}

export default redis;