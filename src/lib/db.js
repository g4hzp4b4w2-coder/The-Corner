import { supabase } from "./supabaseClient";
import { resizeImage } from "./media";

export async function getProfile(userId) {
  const { data, error } = await supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    displayName: data.display_name,
    years: data.years,
    style: data.style,
    school: data.school,
    strengths: data.strengths || [],
    weaknesses: data.weaknesses || [],
    ratings: data.ratings || {},
    lang: data.lang || "tr",
    heightCm: data.height_cm ?? null,
    weightKg: data.weight_kg ?? null,
    weightClass: data.weight_class ?? "",
    reachCm: data.reach_cm ?? null,
  };
}

export async function upsertProfile(userId, profile) {
  const row = {
    user_id: userId,
    display_name: profile.displayName,
    years: profile.years,
    style: profile.style,
    school: profile.school,
    strengths: profile.strengths || [],
    weaknesses: profile.weaknesses || [],
    ratings: profile.ratings || {},
    height_cm: profile.heightCm || null,
    weight_kg: profile.weightKg || null,
    weight_class: profile.weightClass || "",
    reach_cm: profile.reachCm || null,
  };
  if (profile.lang) row.lang = profile.lang;
  const { error } = await supabase.from("profiles").upsert(row);
  if (error) throw error;
}

export async function deleteProfile(userId) {
  const { error } = await supabase.from("profiles").delete().eq("user_id", userId);
  if (error) throw error;
}

function rowToEntry(row) {
  return {
    id: row.id,
    label: row.label,
    type: row.type,
    duration: row.duration,
    note: row.note,
    tags: row.tags || [],
    blocks: row.blocks || [],
    categories: row.categories || [],
    hasVideo: row.has_video,
    frames: row.frames || [],
    planKey: row.plan_key,
    threeMinRounds: row.three_min_rounds || 0,
    createdAt: new Date(row.created_at).getTime(),
  };
}

export async function getJournalEntries(userId) {
  const { data, error } = await supabase
    .from("journal_entries")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map(rowToEntry);
}

export async function addJournalEntry(userId, entry) {
  const { data, error } = await supabase
    .from("journal_entries")
    .insert({
      user_id: userId,
      label: entry.label,
      type: entry.type,
      duration: entry.duration,
      note: entry.note,
      tags: entry.tags || [],
      blocks: entry.blocks || [],
      categories: entry.categories || [],
      has_video: entry.hasVideo || false,
      frames: entry.frames || [],
      plan_key: entry.planKey || null,
      three_min_rounds: entry.threeMinRounds || 0,
    })
    .select()
    .single();
  if (error) throw error;
  return rowToEntry(data);
}

export async function deleteJournalEntryByPlanKey(userId, planKey) {
  const { error } = await supabase.from("journal_entries").delete().eq("user_id", userId).eq("plan_key", planKey);
  if (error) throw error;
}

export async function deleteJournalEntry(userId, id) {
  const { error } = await supabase.from("journal_entries").delete().eq("user_id", userId).eq("id", id);
  if (error) throw error;
}

export async function resetJournalEntries(userId) {
  const { error } = await supabase.from("journal_entries").delete().eq("user_id", userId);
  if (error) throw error;
}

export async function getCommunityPosts(userId) {
  const { data, error } = await supabase
    .from("community_posts")
    .select("*, post_likes(user_id), post_comments(id)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map((p) => ({
    id: p.id,
    userId: p.user_id,
    name: p.name,
    initials: p.initials,
    timestamp: new Date(p.created_at).getTime(),
    text: p.text,
    stat: p.stat,
    topic: p.topic || "Genel",
    imageUrl: p.image_url || null,
    likes: p.post_likes.length,
    comments: p.post_comments.length,
    liked: p.post_likes.some((l) => l.user_id === userId),
    verified: p.verified,
  }));
}

export async function addCommunityPost(userId, { name, initials, text, stat, topic, imageUrl }) {
  const { error } = await supabase
    .from("community_posts")
    .insert({ user_id: userId, name, initials, text, stat: stat || null, topic: topic || "Genel", image_url: imageUrl || null });
  if (error) throw error;
}

export async function deleteCommunityPost(postId, userId) {
  const { error } = await supabase.from("community_posts").delete().eq("id", postId).eq("user_id", userId);
  if (error) throw error;
}

export async function uploadCommunityImage(userId, file) {
  const blob = await resizeImage(file);
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await supabase.storage.from("community-media").upload(path, blob, { contentType: "image/jpeg" });
  if (error) throw error;
  const { data } = supabase.storage.from("community-media").getPublicUrl(path);
  return data.publicUrl;
}

export async function reportPost(postId, reporterId, reason) {
  const { error } = await supabase.from("post_reports").insert({ post_id: postId, reporter_id: reporterId, reason: reason || null });
  if (error) throw error;
}

export async function getPostComments(postId) {
  const { data, error } = await supabase
    .from("post_comments")
    .select("*")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data.map((c) => ({
    id: c.id,
    userId: c.user_id,
    name: c.name,
    initials: c.initials,
    text: c.text,
    timestamp: new Date(c.created_at).getTime(),
  }));
}

export async function addPostComment(postId, userId, { name, initials, text }) {
  const { data, error } = await supabase
    .from("post_comments")
    .insert({ post_id: postId, user_id: userId, name, initials, text })
    .select()
    .single();
  if (error) throw error;
  return {
    id: data.id,
    userId: data.user_id,
    name: data.name,
    initials: data.initials,
    text: data.text,
    timestamp: new Date(data.created_at).getTime(),
  };
}

export async function getMatchPollVotes(matchId, userId) {
  const { data, error } = await supabase.from("match_poll_votes").select("choice, user_id").eq("match_id", matchId);
  if (error) throw error;
  const counts = { a: 0, b: 0 };
  let myChoice = null;
  data.forEach((v) => {
    counts[v.choice] = (counts[v.choice] || 0) + 1;
    if (v.user_id === userId) myChoice = v.choice;
  });
  return { counts, myChoice };
}

export async function voteOnMatch(matchId, userId, choice) {
  const { error } = await supabase
    .from("match_poll_votes")
    .upsert({ match_id: matchId, user_id: userId, choice }, { onConflict: "match_id,user_id" });
  if (error) throw error;
}

export async function getMatchComments(matchId) {
  const { data, error } = await supabase
    .from("match_comments")
    .select("*")
    .eq("match_id", matchId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data.map((c) => ({
    id: c.id,
    userId: c.user_id,
    name: c.name,
    initials: c.initials,
    text: c.text,
    timestamp: new Date(c.created_at).getTime(),
  }));
}

export async function addMatchComment(matchId, userId, { name, initials, text }) {
  const { data, error } = await supabase
    .from("match_comments")
    .insert({ match_id: matchId, user_id: userId, name, initials, text })
    .select()
    .single();
  if (error) throw error;
  return {
    id: data.id,
    userId: data.user_id,
    name: data.name,
    initials: data.initials,
    text: data.text,
    timestamp: new Date(data.created_at).getTime(),
  };
}

export async function toggleLike(postId, userId, currentlyLiked) {
  if (currentlyLiked) {
    const { error } = await supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", userId);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("post_likes").insert({ post_id: postId, user_id: userId });
    if (error) throw error;
  }
}

export async function getChatMessages(userId) {
  const { data, error } = await supabase
    .from("coach_messages")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data.map((m) => ({ id: m.id, role: m.role, content: m.content, timestamp: new Date(m.created_at).getTime() }));
}

export async function addChatMessage(userId, role, content) {
  const { data, error } = await supabase
    .from("coach_messages")
    .insert({ user_id: userId, role, content })
    .select()
    .single();
  if (error) throw error;
  return { id: data.id, role: data.role, content: data.content, timestamp: new Date(data.created_at).getTime() };
}

export async function resetChatMessages(userId) {
  const { error } = await supabase.from("coach_messages").delete().eq("user_id", userId);
  if (error) throw error;
}
