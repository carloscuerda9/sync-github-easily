
-- ============================================
-- ENUMS
-- ============================================
CREATE TYPE public.app_role AS ENUM ('player', 'physio', 'superadmin');
CREATE TYPE public.account_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.appointment_status AS ENUM ('requested', 'confirmed', 'cancelled', 'completed', 'rejected');
CREATE TYPE public.appointment_type AS ENUM ('in_person', 'home_visit', 'sports_event');
CREATE TYPE public.invoice_status AS ENUM ('draft', 'sent', 'paid');

-- ============================================
-- PROFILES
-- ============================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  role public.app_role NOT NULL DEFAULT 'player',
  status public.account_status NOT NULL DEFAULT 'pending',
  profile_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============================================
-- USER ROLES (separate table for security)
-- ============================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (no recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_approved(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id AND status = 'approved'
  )
$$;

-- ============================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role public.app_role;
  _status public.account_status;
  _full_name TEXT;
  _phone TEXT;
  _profile_data JSONB;
BEGIN
  -- Superadmin override by email
  IF NEW.email = 'admin@wefixyou.com' THEN
    _role := 'superadmin';
    _status := 'approved';
  ELSE
    _role := COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'player');
    -- Players auto-approve, physios need manual approval
    IF _role = 'player' THEN
      _status := 'approved';
    ELSE
      _status := 'pending';
    END IF;
  END IF;

  _full_name := NEW.raw_user_meta_data->>'full_name';
  _phone := NEW.raw_user_meta_data->>'phone';
  _profile_data := COALESCE(NEW.raw_user_meta_data->'profile_data', '{}'::jsonb);

  INSERT INTO public.profiles (id, email, full_name, phone, role, status, profile_data)
  VALUES (NEW.id, NEW.email, _full_name, _phone, _role, _status, _profile_data);

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, _role);

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================
-- APPOINTMENTS
-- ============================================
CREATE TABLE public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  physio_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 60,
  type public.appointment_type NOT NULL DEFAULT 'in_person',
  status public.appointment_status NOT NULL DEFAULT 'requested',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER appointments_updated_at BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================
-- MESSAGES
-- ============================================
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- ============================================
-- DOCUMENTS
-- ============================================
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uploader_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  file_url TEXT NOT NULL,
  file_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- ============================================
-- INJURIES
-- ============================================
CREATE TABLE public.injuries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  physio_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  injury_date DATE NOT NULL,
  body_part TEXT NOT NULL,
  injury_type TEXT NOT NULL,
  severity TEXT,
  treatment TEXT,
  recovery_days INT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.injuries ENABLE ROW LEVEL SECURITY;

-- ============================================
-- SESSIONS (notes per appointment)
-- ============================================
CREATE TABLE public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  physio_notes TEXT,
  player_feedback TEXT,
  duration_actual INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- INVOICES
-- ============================================
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  physio_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  amount NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  concept TEXT,
  status public.invoice_status NOT NULL DEFAULT 'draft',
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ,
  pdf_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- ============================================
-- FORMS
-- ============================================
CREATE TABLE public.forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  physio_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  external_url TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.forms ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.form_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  UNIQUE (form_id, player_id)
);
ALTER TABLE public.form_assignments ENABLE ROW LEVEL SECURITY;

-- ============================================
-- REGISTRATION QUESTIONS (configurable)
-- ============================================
CREATE TABLE public.registration_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role public.app_role NOT NULL,
  field_key TEXT NOT NULL,
  question_text TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'text',
  options JSONB DEFAULT '[]'::jsonb,
  required BOOLEAN NOT NULL DEFAULT false,
  display_order INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (role, field_key)
);
ALTER TABLE public.registration_questions ENABLE ROW LEVEL SECURITY;

-- Seed player questions
INSERT INTO public.registration_questions (role, field_key, question_text, field_type, options, required, display_order) VALUES
  ('player', 'date_of_birth', 'Fecha de nacimiento', 'date', '[]', true, 1),
  ('player', 'sport', 'Deporte / Disciplina', 'text', '[]', true, 2),
  ('player', 'years_playing', 'Años practicándolo', 'number', '[]', false, 3),
  ('player', 'field_position', 'Posición / Categoría', 'text', '[]', false, 4),
  ('player', 'dominant_side', 'Pierna / brazo dominante', 'select', '["Derecho","Izquierdo","Ambidiestro"]', false, 5),
  ('player', 'previous_injuries', 'Lesiones previas (opcional)', 'textarea', '[]', false, 6),
  ('player', 'club', 'Club o equipo', 'text', '[]', false, 7);

-- Seed physio questions
INSERT INTO public.registration_questions (role, field_key, question_text, field_type, options, required, display_order) VALUES
  ('physio', 'license_number', 'Número de colegiado', 'text', '[]', true, 1),
  ('physio', 'years_experience', 'Años de experiencia', 'number', '[]', true, 2),
  ('physio', 'specializations', 'Especializaciones', 'multiselect', '["Deportiva","Neurológica","Pediátrica","Geriátrica","Traumatológica","Respiratoria"]', false, 3),
  ('physio', 'working_hours', 'Horario disponible', 'textarea', '[]', false, 4);

-- ============================================
-- HELPER: physio has relationship with player
-- ============================================
CREATE OR REPLACE FUNCTION public.physio_treats_player(_physio_id UUID, _player_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.appointments
    WHERE physio_id = _physio_id AND player_id = _player_id
  )
$$;

-- ============================================
-- RLS POLICIES
-- ============================================

-- PROFILES
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Superadmin views all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'superadmin'));
CREATE POLICY "Players can view physios" ON public.profiles
  FOR SELECT TO authenticated USING (
    role = 'physio' AND status = 'approved'
    AND public.has_role(auth.uid(), 'player')
  );
CREATE POLICY "Physios view their players" ON public.profiles
  FOR SELECT TO authenticated USING (
    role = 'player'
    AND public.has_role(auth.uid(), 'physio')
    AND public.physio_treats_player(auth.uid(), id)
  );
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Superadmin updates any profile" ON public.profiles
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'superadmin'));

-- USER_ROLES
CREATE POLICY "Users view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Superadmin manages roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'superadmin'));

-- APPOINTMENTS
CREATE POLICY "Players view own appointments" ON public.appointments
  FOR SELECT TO authenticated USING (player_id = auth.uid());
CREATE POLICY "Physios view own appointments" ON public.appointments
  FOR SELECT TO authenticated USING (physio_id = auth.uid());
CREATE POLICY "Superadmin views all appointments" ON public.appointments
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'superadmin'));
CREATE POLICY "Players create appointments" ON public.appointments
  FOR INSERT TO authenticated WITH CHECK (
    player_id = auth.uid() AND public.has_role(auth.uid(), 'player')
  );
CREATE POLICY "Players update own appointments" ON public.appointments
  FOR UPDATE TO authenticated USING (player_id = auth.uid());
CREATE POLICY "Physios update own appointments" ON public.appointments
  FOR UPDATE TO authenticated USING (physio_id = auth.uid());

-- MESSAGES
CREATE POLICY "Users view own messages" ON public.messages
  FOR SELECT TO authenticated USING (
    sender_id = auth.uid() OR receiver_id = auth.uid()
  );
CREATE POLICY "Superadmin views all messages" ON public.messages
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'superadmin'));
CREATE POLICY "Users send messages" ON public.messages
  FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid());
CREATE POLICY "Receiver marks read" ON public.messages
  FOR UPDATE TO authenticated USING (receiver_id = auth.uid());

-- DOCUMENTS
CREATE POLICY "Users view own documents" ON public.documents
  FOR SELECT TO authenticated USING (
    uploader_id = auth.uid() OR recipient_id = auth.uid()
  );
CREATE POLICY "Superadmin views all documents" ON public.documents
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'superadmin'));
CREATE POLICY "Users upload documents" ON public.documents
  FOR INSERT TO authenticated WITH CHECK (uploader_id = auth.uid());
CREATE POLICY "Uploader deletes documents" ON public.documents
  FOR DELETE TO authenticated USING (uploader_id = auth.uid());

-- INJURIES
CREATE POLICY "Players view own injuries" ON public.injuries
  FOR SELECT TO authenticated USING (player_id = auth.uid());
CREATE POLICY "Physios view player injuries" ON public.injuries
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'physio')
    AND public.physio_treats_player(auth.uid(), player_id)
  );
CREATE POLICY "Superadmin views all injuries" ON public.injuries
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'superadmin'));
CREATE POLICY "Physios create injuries" ON public.injuries
  FOR INSERT TO authenticated WITH CHECK (
    public.has_role(auth.uid(), 'physio') AND physio_id = auth.uid()
  );
CREATE POLICY "Physios update own injuries" ON public.injuries
  FOR UPDATE TO authenticated USING (physio_id = auth.uid());

-- SESSIONS
CREATE POLICY "Participants view sessions" ON public.sessions
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.id = appointment_id
      AND (a.player_id = auth.uid() OR a.physio_id = auth.uid())
    )
  );
CREATE POLICY "Superadmin views all sessions" ON public.sessions
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'superadmin'));
CREATE POLICY "Physios manage sessions" ON public.sessions
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.id = appointment_id AND a.physio_id = auth.uid()
    )
  );

-- INVOICES
CREATE POLICY "Players view own invoices" ON public.invoices
  FOR SELECT TO authenticated USING (player_id = auth.uid());
CREATE POLICY "Physios view own invoices" ON public.invoices
  FOR SELECT TO authenticated USING (physio_id = auth.uid());
CREATE POLICY "Superadmin views all invoices" ON public.invoices
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'superadmin'));
CREATE POLICY "Physios create invoices" ON public.invoices
  FOR INSERT TO authenticated WITH CHECK (physio_id = auth.uid());
CREATE POLICY "Physios update own invoices" ON public.invoices
  FOR UPDATE TO authenticated USING (physio_id = auth.uid());

-- FORMS
CREATE POLICY "Physios view own forms" ON public.forms
  FOR SELECT TO authenticated USING (physio_id = auth.uid());
CREATE POLICY "Players view assigned forms via assignments" ON public.forms
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.form_assignments fa
      WHERE fa.form_id = id AND fa.player_id = auth.uid()
    )
  );
CREATE POLICY "Superadmin views all forms" ON public.forms
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'superadmin'));
CREATE POLICY "Physios manage own forms" ON public.forms
  FOR ALL TO authenticated USING (physio_id = auth.uid());

-- FORM ASSIGNMENTS
CREATE POLICY "Players view own assignments" ON public.form_assignments
  FOR SELECT TO authenticated USING (player_id = auth.uid());
CREATE POLICY "Physios view assignments of own forms" ON public.form_assignments
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.forms f WHERE f.id = form_id AND f.physio_id = auth.uid())
  );
CREATE POLICY "Superadmin views all assignments" ON public.form_assignments
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'superadmin'));
CREATE POLICY "Physios manage assignments" ON public.form_assignments
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.forms f WHERE f.id = form_id AND f.physio_id = auth.uid())
  );

-- REGISTRATION QUESTIONS
CREATE POLICY "Anyone can read active questions" ON public.registration_questions
  FOR SELECT TO anon, authenticated USING (active = true);
CREATE POLICY "Superadmin manages questions" ON public.registration_questions
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'superadmin'));
