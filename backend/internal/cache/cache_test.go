package cache

import (
	"context"
	"testing"
)

// Without Configure, the cache must behave as disabled:
// misses return false, writes are no-ops, never errors.
func TestDisabledCacheFallsBack(t *testing.T) {
	Close()
	if Enabled() {
		t.Fatal("expected cache to be disabled without Configure")
	}
	var dest []string
	if GetJSON(context.Background(), KeyLeaderboard, &dest) {
		t.Fatal("expected miss when disabled")
	}
	// Must not panic or block.
	SetJSON(context.Background(), KeyLeaderboard, []string{"a"}, TTLLeaderboard)
	Del(context.Background(), KeyLeaderboard)
}

func TestFAQsKey(t *testing.T) {
	if FAQsKey("") != FAQsKeyPrefix+"all" {
		t.Fatalf("empty examType should map to all, got %q", FAQsKey(""))
	}
	if FAQsKey("jee") != FAQsKeyPrefix+"jee" {
		t.Fatalf("unexpected key %q", FAQsKey("jee"))
	}
}
