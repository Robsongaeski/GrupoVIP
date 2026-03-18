-- Add cpf_cnpj column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS cpf_cnpj TEXT;

-- Create index for cpf_cnpj (useful for lookups)
CREATE INDEX IF NOT EXISTS idx_profiles_cpf_cnpj ON public.profiles(cpf_cnpj);