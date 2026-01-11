-- V41: Add home invitation email template and update invite_to_home to send emails

-- Add home_invitation email template
ALTER TABLE email_templates DISABLE ROW LEVEL SECURITY;

INSERT INTO email_templates (name, subject, html_body, text_body, variables, description, language, owner)
VALUES (
    'home_invitation',
    'Du har blivit inbjuden till {{home_name}}',
    '<html><body><h1>Du har blivit inbjuden!</h1><p>Hej,</p><p>{{inviter_email}} har bjudit in dig till hemmet "{{home_name}}" på Recept.</p><p>Klicka på länken nedan för att acceptera inbjudan:</p><p><a href="{{accept_link}}">Acceptera inbjudan</a></p><p>Inbjudan är giltig i 7 dagar.</p><p>Om du inte har ett konto kan du skapa ett när du klickar på länken.</p></body></html>',
    'Hej,\n\n{{inviter_email}} har bjudit in dig till hemmet "{{home_name}}" på Recept.\n\nKlicka på länken nedan för att acceptera inbjudan:\n{{accept_link}}\n\nInbjudan är giltig i 7 dagar.\n\nOm du inte har ett konto kan du skapa ett när du klickar på länken.',
    '{"inviter_email": "string", "home_name": "string", "accept_link": "string"}'::jsonb,
    'Email sent when user is invited to join a home',
    'sv',
    'system@recept.local'
)
ON CONFLICT (name, language) DO NOTHING;

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

-- Update invite_to_home to queue an email
CREATE OR REPLACE FUNCTION invite_to_home(p_email TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_user_email TEXT;
  v_home_id UUID;
  v_home_name TEXT;
  v_token TEXT;
  v_invitation_id UUID;
  v_base_url TEXT := 'https://recept.stenberg.io';
BEGIN
  -- Get current user email from JWT
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'not-authenticated';
  END IF;

  -- Get user's home_id and home name
  SELECT u.home_id, h.name INTO v_home_id, v_home_name
  FROM users u
  JOIN homes h ON h.id = u.home_id
  WHERE u.email = v_user_email;

  IF v_home_id IS NULL THEN
    RAISE EXCEPTION 'user-has-no-home';
  END IF;

  -- Validate email
  IF p_email IS NULL OR LENGTH(TRIM(p_email)) < 1 THEN
    RAISE EXCEPTION 'invalid-email';
  END IF;

  -- Check if user is trying to invite themselves
  IF LOWER(TRIM(p_email)) = LOWER(v_user_email) THEN
    RAISE EXCEPTION 'cannot-invite-self';
  END IF;

  -- Check if invited user is already a member
  IF EXISTS (SELECT 1 FROM users WHERE email = LOWER(TRIM(p_email)) AND home_id = v_home_id) THEN
    RAISE EXCEPTION 'user-already-member';
  END IF;

  -- Check for existing pending invitation
  IF EXISTS (
    SELECT 1 FROM home_invitations
    WHERE home_id = v_home_id
      AND invited_email = LOWER(TRIM(p_email))
      AND status = 'pending'
      AND expires_at > now()
  ) THEN
    RAISE EXCEPTION 'invitation-already-pending';
  END IF;

  -- Generate secure token (64 hex characters = 32 bytes)
  v_token := encode(gen_random_bytes(32), 'hex');

  -- Create invitation
  INSERT INTO home_invitations (home_id, invited_email, invited_by_email, token)
  VALUES (v_home_id, LOWER(TRIM(p_email)), v_user_email, v_token)
  RETURNING id INTO v_invitation_id;

  -- Queue invitation email
  PERFORM queue_email(
    'home_invitation',
    LOWER(TRIM(p_email)),
    jsonb_build_object(
      'inviter_email', v_user_email,
      'home_name', v_home_name,
      'accept_link', v_base_url || '/hem/inbjudan/' || v_token
    )
  );

  RETURN v_invitation_id;
END;
$func$;
