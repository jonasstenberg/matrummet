-- V46: Grant EXECUTE on pg_trgm functions to anon role
-- Fixes: 403 "permission denied for function word_similarity"
-- These functions are used in search_recipes() and search_liked_recipes() for ranking

GRANT EXECUTE ON FUNCTION word_similarity(TEXT, TEXT) TO "anon";
GRANT EXECUTE ON FUNCTION similarity(TEXT, TEXT) TO "anon";
