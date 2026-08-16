CREATE OR REPLACE FUNCTION public.guard_entry_payment_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- service role / internal (no JWT) and admins may set payment fields freely
  IF auth.uid() IS NULL OR private.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.payment_status := 'pending';
    NEW.payment_ref := NULL;
    NEW.entry_ninja_ref := NULL;
  ELSE
    NEW.payment_status := OLD.payment_status;
    NEW.payment_ref := OLD.payment_ref;
    NEW.entry_ninja_ref := OLD.entry_ninja_ref;
    NEW.total_cents := OLD.total_cents;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS entries_guard_payment_fields ON public.entries;
CREATE TRIGGER entries_guard_payment_fields
BEFORE INSERT OR UPDATE ON public.entries
FOR EACH ROW EXECUTE FUNCTION public.guard_entry_payment_fields();