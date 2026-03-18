-- Create table to store multiple instances for a campaign
CREATE TABLE public.campaign_instances (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
    instance_id UUID NOT NULL REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(campaign_id, instance_id)
);

-- Enable RLS
ALTER TABLE public.campaign_instances ENABLE ROW LEVEL SECURITY;

-- Create policies - users can manage their own campaign instances
CREATE POLICY "Users can view their own campaign instances"
ON public.campaign_instances
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.campaigns 
        WHERE campaigns.id = campaign_instances.campaign_id 
        AND campaigns.user_id = auth.uid()
    )
);

CREATE POLICY "Users can insert their own campaign instances"
ON public.campaign_instances
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.campaigns 
        WHERE campaigns.id = campaign_instances.campaign_id 
        AND campaigns.user_id = auth.uid()
    )
);

CREATE POLICY "Users can delete their own campaign instances"
ON public.campaign_instances
FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM public.campaigns 
        WHERE campaigns.id = campaign_instances.campaign_id 
        AND campaigns.user_id = auth.uid()
    )
);

-- Create index for performance
CREATE INDEX idx_campaign_instances_campaign ON public.campaign_instances(campaign_id);
CREATE INDEX idx_campaign_instances_instance ON public.campaign_instances(instance_id);