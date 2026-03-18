
CREATE POLICY "Users can delete clicks of their links"
ON public.link_clicks
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM intelligent_links
  WHERE intelligent_links.id = link_clicks.link_id
  AND intelligent_links.user_id = auth.uid()
));
