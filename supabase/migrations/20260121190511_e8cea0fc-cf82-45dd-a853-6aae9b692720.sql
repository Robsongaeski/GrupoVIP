-- Remove false positive failure logs created by the stuck campaign recovery
-- These are logs marked as "failed" with timeout error, but where another log for the same 
-- group+item combination already shows "sent" status
DELETE FROM send_logs 
WHERE id IN (
    SELECT failed_logs.id
    FROM send_logs failed_logs
    INNER JOIN send_logs sent_logs 
        ON failed_logs.campaign_id = sent_logs.campaign_id
        AND failed_logs.group_id = sent_logs.group_id
        AND failed_logs.campaign_item_id = sent_logs.campaign_item_id
    WHERE failed_logs.status = 'failed'
        AND failed_logs.error_message = 'Campanha expirou - timeout do servidor'
        AND sent_logs.status = 'sent'
);