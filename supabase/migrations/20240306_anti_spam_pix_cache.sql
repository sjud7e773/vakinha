-- Migration: Sistema Anti-Spam e Reutilização de PIX
-- Cria tabelas para cache de PIX e controle de abuso

-- Tabela para cache de PIX ativos (reutilização)
CREATE TABLE IF NOT EXISTS pix_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address TEXT NOT NULL,
  fingerprint TEXT,
  operation_type TEXT NOT NULL, -- 'donation' ou 'hearts'
  amount NUMERIC(10,2) NOT NULL,
  heart_plan_id INTEGER, -- NULL para doações, 1/2/3 para corações
  qr_code_base64 TEXT NOT NULL,
  copy_paste TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  order_uuid TEXT,
  status TEXT DEFAULT 'pending', -- pending, paid, expired, cancelled
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Índice único para evitar duplicatas do mesmo PIX ativo
  CONSTRAINT pix_cache_unique_active UNIQUE (ip_address, fingerprint, operation_type, amount, heart_plan_id, status)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_pix_cache_ip ON pix_cache(ip_address);
CREATE INDEX IF NOT EXISTS idx_pix_cache_fingerprint ON pix_cache(fingerprint);
CREATE INDEX IF NOT EXISTS idx_pix_cache_expires ON pix_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_pix_cache_status ON pix_cache(status);

-- Tabela para controle de abuso (anti-spam)
CREATE TABLE IF NOT EXISTS pix_abuse_control (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address TEXT NOT NULL,
  fingerprint TEXT,
  pix_count INTEGER DEFAULT 0,
  paid_count INTEGER DEFAULT 0,
  window_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  blocked_until TIMESTAMP WITH TIME ZONE,
  last_pix_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para controle de abuso
CREATE INDEX IF NOT EXISTS idx_abuse_ip ON pix_abuse_control(ip_address);
CREATE INDEX IF NOT EXISTS idx_abuse_fingerprint ON pix_abuse_control(fingerprint);
CREATE INDEX IF NOT EXISTS idx_abuse_blocked ON pix_abuse_control(blocked_until);

-- Função para verificar se existe PIX ativo
CREATE OR REPLACE FUNCTION get_active_pix(
  p_ip TEXT,
  p_fingerprint TEXT,
  p_operation_type TEXT,
  p_amount NUMERIC,
  p_heart_plan_id INTEGER
)
RETURNS TABLE (
  qr_code_base64 TEXT,
  copy_paste TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  order_uuid TEXT,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pc.qr_code_base64,
    pc.copy_paste,
    pc.expires_at,
    pc.order_uuid,
    pc.created_at
  FROM pix_cache pc
  WHERE pc.ip_address = p_ip
    AND (p_fingerprint IS NULL OR pc.fingerprint = p_fingerprint)
    AND pc.operation_type = p_operation_type
    AND pc.amount = p_amount
    AND (p_heart_plan_id IS NULL OR pc.heart_plan_id = p_heart_plan_id)
    AND pc.status = 'pending'
    AND pc.expires_at > NOW()
  ORDER BY pc.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para salvar novo PIX no cache
CREATE OR REPLACE FUNCTION save_pix_to_cache(
  p_ip TEXT,
  p_fingerprint TEXT,
  p_operation_type TEXT,
  p_amount NUMERIC,
  p_heart_plan_id INTEGER,
  p_qr_code TEXT,
  p_copy_paste TEXT,
  p_expires_at TIMESTAMP WITH TIME ZONE,
  p_order_uuid TEXT
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  -- Inativa PIX antigos do mesmo usuário/valor (se existirem)
  UPDATE pix_cache
  SET status = 'expired', updated_at = NOW()
  WHERE ip_address = p_ip
    AND operation_type = p_operation_type
    AND amount = p_amount
    AND (p_heart_plan_id IS NULL OR heart_plan_id = p_heart_plan_id)
    AND status = 'pending';

  -- Insere novo PIX
  INSERT INTO pix_cache (
    ip_address, fingerprint, operation_type, amount, heart_plan_id,
    qr_code_base64, copy_paste, expires_at, order_uuid, status
  ) VALUES (
    p_ip, p_fingerprint, p_operation_type, p_amount, p_heart_plan_id,
    p_qr_code, p_copy_paste, p_expires_at, p_order_uuid, 'pending'
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para verificar e registrar abuso
CREATE OR REPLACE FUNCTION check_pix_abuse(
  p_ip TEXT,
  p_fingerprint TEXT
)
RETURNS TABLE (
  is_blocked BOOLEAN,
  blocked_until TIMESTAMP WITH TIME ZONE,
  reason TEXT
) AS $$
DECLARE
  v_record RECORD;
  v_is_blocked BOOLEAN := FALSE;
  v_blocked_until TIMESTAMP WITH TIME ZONE;
  v_reason TEXT := 'ok';
  v_pix_count INTEGER;
  v_paid_count INTEGER;
  v_window_start TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Busca ou cria registro de controle
  SELECT * INTO v_record
  FROM pix_abuse_control
  WHERE ip_address = p_ip
    AND (p_fingerprint IS NULL OR fingerprint = p_fingerprint)
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    -- Primeira vez - cria registro
    INSERT INTO pix_abuse_control (ip_address, fingerprint, pix_count, window_start)
    VALUES (p_ip, p_fingerprint, 1, NOW());
    
    RETURN QUERY SELECT FALSE, NULL::TIMESTAMP WITH TIME ZONE, 'ok'::TEXT;
    RETURN;
  END IF;

  -- Verifica se está bloqueado
  IF v_record.blocked_until IS NOT NULL AND v_record.blocked_until > NOW() THEN
    v_is_blocked := TRUE;
    v_blocked_until := v_record.blocked_until;
    v_reason := 'blocked';
    
    RETURN QUERY SELECT v_is_blocked, v_blocked_until, v_reason;
    RETURN;
  END IF;

  -- Reseta janela se passou mais de 5 minutos
  IF v_record.window_start < NOW() - INTERVAL '5 minutes' THEN
    v_pix_count := 1;
    v_paid_count := 0;
    v_window_start := NOW();
  ELSE
    v_pix_count := v_record.pix_count + 1;
    v_paid_count := v_record.paid_count;
  END IF;

  -- Verifica regra de abuso: >5 PIX em 5 minutos sem pagamento
  IF v_pix_count > 5 AND v_paid_count = 0 THEN
    v_is_blocked := TRUE;
    v_blocked_until := NOW() + INTERVAL '15 minutes';
    v_reason := 'abuse_detected';
  END IF;

  -- Atualiza registro
  UPDATE pix_abuse_control
  SET 
    pix_count = v_pix_count,
    paid_count = v_paid_count,
    window_start = v_window_start,
    blocked_until = v_blocked_until,
    last_pix_at = NOW(),
    updated_at = NOW()
  WHERE id = v_record.id;

  RETURN QUERY SELECT v_is_blocked, v_blocked_until, v_reason;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para marcar PIX como pago (atualiza contagem de pagamentos)
CREATE OR REPLACE FUNCTION mark_pix_as_paid(
  p_order_uuid TEXT
)
RETURNS VOID AS $$
BEGIN
  -- Atualiza status do PIX
  UPDATE pix_cache
  SET status = 'paid', updated_at = NOW()
  WHERE order_uuid = p_order_uuid AND status = 'pending';

  -- Atualiza contagem de pagamentos no controle de abuso
  -- Isso "perdoa" o usuário por ter gerado muitos PIX
  UPDATE pix_abuse_control
  SET paid_count = paid_count + 1,
      blocked_until = NULL, -- Remove bloqueio se existir
      updated_at = NOW()
  WHERE ip_address IN (
    SELECT ip_address FROM pix_cache WHERE order_uuid = p_order_uuid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para limpar PIX expirados (pode ser chamada por cron)
CREATE OR REPLACE FUNCTION cleanup_expired_pix()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE pix_cache
  SET status = 'expired', updated_at = NOW()
  WHERE status = 'pending' AND expires_at < NOW();
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Políticas de segurança RLS (Row Level Security)
ALTER TABLE pix_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE pix_abuse_control ENABLE ROW LEVEL SECURITY;

-- Apenas service role pode acessar (Edge Function)
CREATE POLICY pix_cache_service ON pix_cache
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY pix_abuse_service ON pix_abuse_control
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Nenhum acesso anônimo
CREATE POLICY pix_cache_no_anon ON pix_cache
  FOR ALL TO anon USING (false);

CREATE POLICY pix_abuse_no_anon ON pix_abuse_control
  FOR ALL TO anon USING (false);
