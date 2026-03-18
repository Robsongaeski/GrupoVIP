-- Reset is_user_admin flag for user to force re-detection on next sync
UPDATE groups SET is_user_admin = false WHERE user_id = '913b2cc1-05d1-462f-808b-f7e70e2eb5c3';