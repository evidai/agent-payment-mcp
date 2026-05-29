-- PermitCharge に手数料分割カラムを追加（料金モデル変更: セラー通算の初回
-- freeCallsPerMonth コールは無料、それ以降は pricePerCallUsdc を徴収し、うち
-- 手数料 bps（デフォルト 3%）を LemonCake が受け取る = 97% セラー / 3% LemonCake）。
--
--   amountUsdc  = バイヤーが支払った総額（gross）
--   feeUsdc     = うち LemonCake 手数料（無料枠内 / 徴収スキップ時は 0 or NULL）
--   feeTxHash   = 手数料 transferFrom の on-chain tx（徴収した場合のみ）
--
-- serviceId+status インデックスは「セラー通算の COMPLETED 件数」を高速に数える
-- ためのもの（無料枠 3,000 の判定に使用）。
--
-- 注: schema.prisma に追加後 prisma db push でローカル反映する運用。この migration
-- ファイルは Railway の prisma migrate deploy が schema drift せず通るための後追い
-- 宣言。IF NOT EXISTS でべき等。

ALTER TABLE "permit_charges" ADD COLUMN IF NOT EXISTS "feeUsdc" DECIMAL(38,18);
ALTER TABLE "permit_charges" ADD COLUMN IF NOT EXISTS "feeTxHash" TEXT;

CREATE INDEX IF NOT EXISTS "permit_charges_serviceId_status_idx" ON "permit_charges" ("serviceId", "status");
