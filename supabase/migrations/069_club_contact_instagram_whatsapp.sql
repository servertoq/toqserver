-- Contato público do clube: Instagram + WhatsApp (distinto do WhatsApp da loja).

ALTER TABLE public.communities
  ADD COLUMN IF NOT EXISTS instagram_url TEXT,
  ADD COLUMN IF NOT EXISTS contact_whatsapp TEXT;
