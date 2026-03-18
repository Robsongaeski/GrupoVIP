-- Drop existing restrictive policy
DROP POLICY IF EXISTS "Users can manage their own instances" ON whatsapp_instances;

-- Create new permissive policy (default behavior)
CREATE POLICY "Users can manage their own instances"
ON whatsapp_instances
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);