-- Atualizar a role do usuário principal para admin
UPDATE public.user_roles 
SET role = 'admin' 
WHERE user_id = '913b2cc1-05d1-462f-808b-f7e70e2eb5c3';

-- Também inserir uma nova role admin caso a atualização não funcione (se existir constraint)
INSERT INTO public.user_roles (user_id, role)
VALUES ('913b2cc1-05d1-462f-808b-f7e70e2eb5c3', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;