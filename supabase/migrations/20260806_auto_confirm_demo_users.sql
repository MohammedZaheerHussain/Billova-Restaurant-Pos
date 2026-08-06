-- ============================================================
-- Auto-confirm Demo Accounts in Supabase Auth
-- Automatically confirms email for @billova.test & demo accounts
-- ============================================================

-- Function to auto-confirm demo users upon sign up
CREATE OR REPLACE FUNCTION auto_confirm_demo_users()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email LIKE '%@billova.test' OR (NEW.raw_user_meta_data->>'is_demo')::boolean = true THEN
    NEW.email_confirmed_at = COALESCE(NEW.email_confirmed_at, NOW());
    NEW.confirmed_at = COALESCE(NEW.confirmed_at, NOW());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger before insertion into auth.users
DROP TRIGGER IF EXISTS trigger_auto_confirm_demo_users ON auth.users;

CREATE TRIGGER trigger_auto_confirm_demo_users
BEFORE INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION auto_confirm_demo_users();

-- Instantly confirm all existing demo accounts
UPDATE auth.users
SET email_confirmed_at = NOW(),
    confirmed_at = NOW()
WHERE (email LIKE '%@billova.test' OR (raw_user_meta_data->>'is_demo')::boolean = true)
  AND email_confirmed_at IS NULL;
