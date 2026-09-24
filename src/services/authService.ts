import { supabase } from '../lib/supabase'

export async function getSession() {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data.session
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  })

  if (error) {
    throw error
  }

  return data.session
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export function subscribeToAuth(callback: (session: Awaited<ReturnType<typeof getSession>>) => void) {
  return supabase.auth.onAuthStateChange((_event, session) => callback(session))
}
