-- V15: Allow system tokens to call add_credits
--
-- Problem: add_credits() checks is_admin(), which looks up the caller's email
-- in users.role. The Stripe webhook creates a JWT with the buyer's email +
-- role "authenticated", so is_admin() returns false and credits are never added.
--
-- Fix: Use is_admin_or_system() (introduced in V14) so that system tokens
-- (with { system: true } claim) can also call add_credits.

CREATE OR REPLACE FUNCTION public.add_credits(
  p_user_email text,
  p_amount integer,
  p_transaction_type text,
  p_description text DEFAULT NULL,
  p_stripe_payment_intent_id text DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Admin or system check: admins and system tokens can add credits via public API
  IF NOT is_admin_or_system() THEN
    RAISE EXCEPTION 'Access denied: admin or system privileges required';
  END IF;

  -- Validate amount
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  -- Validate user exists
  IF NOT EXISTS (SELECT 1 FROM users WHERE email = p_user_email) THEN
    RAISE EXCEPTION 'User not found: %', p_user_email;
  END IF;

  -- Delegate to internal function
  RETURN _add_credits_internal(p_user_email, p_amount, p_transaction_type, p_description, p_stripe_payment_intent_id);
END;
$$;
