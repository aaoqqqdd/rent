-- 完善.md §24 / §36 — 公开合同验证页需要 contract_number + verification_token。
-- 0101 加了 verification_token 列，但历史已签署合同没有令牌，无法被核验。
-- 这里为所有已定稿（signed / completed）且缺令牌的合同回填 64 位十六进制高熵令牌。
UPDATE contracts
SET verification_token = lower(hex(randomblob(32)))
WHERE verification_token IS NULL
  AND status IN ('signed', 'completed');
