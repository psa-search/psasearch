import { supabase } from './supabase'
import type { PsaCard, SnidanPsaMapping } from '@/types/database'

/**
 * PSA カード情報を一括挿入
 */
export async function insertPsaCards(cards: Omit<PsaCard, 'created_at'>[]) {
  if (!supabase) return
  const { error } = await supabase.from('psa_cards').insert(cards).select()
  if (error) throw error
}

/**
 * Snidan-PSA マッピングを挿入
 */
export async function insertMapping(mapping: SnidanPsaMapping) {
  if (!supabase) return
  const { error } = await supabase.from('snidan_psa_mapping').insert([mapping]).select()
  if (error) throw error
}

/**
 * Snidan ID からマッピングを取得
 */
export async function getMappingBySnidanId(snidanApparelId: number): Promise<SnidanPsaMapping | null> {
  if (!supabase) return null

  const { data, error } = await supabase
    .from('snidan_psa_mapping')
    .select('*')
    .eq('snidan_apparel_id', snidanApparelId)
    .single()

  if (error && error.code !== 'PGRST116') throw error // PGRST116 = not found
  return data ?? null
}

/**
 * カード名で PSA カードを検索
 */
export async function searchPsaCardByName(cardName: string): Promise<PsaCard | null> {
  if (!supabase) return null

  const { data, error } = await supabase
    .from('psa_cards')
    .select('*')
    .ilike('card_name', `%${cardName}%`)
    .limit(1)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return data ?? null
}

/**
 * PSA spec_id からカード情報を取得
 */
export async function getPsaCard(specId: string): Promise<PsaCard | null> {
  if (!supabase) return null

  const { data, error } = await supabase
    .from('psa_cards')
    .select('*')
    .eq('spec_id', specId)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return data ?? null
}
