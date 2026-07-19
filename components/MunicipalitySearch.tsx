"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Search, X } from "lucide-react";
import clsx from "clsx";

type SearchItem = {
  municipalityCode: string | null;
  prefectureName: string;
  municipalityName: string;
  municipalityNameKana?: string | null;
};

let searchIndexPromise: Promise<SearchItem[]> | null = null;

function loadSearchIndex() {
  searchIndexPromise ??= fetch("/data/static/search-index.json")
    .then((response) => {
      if (!response.ok) throw new Error("Search index unavailable");
      return response.json();
    });
  return searchIndexPromise;
}

type SearchVariant = "default" | "hero" | "command";

export function MunicipalitySearch({
  prefectures,
  defaultQuery = "",
  defaultPrefecture = "",
  compact = false,
  variant = "default"
}: {
  prefectures: string[];
  defaultQuery?: string;
  defaultPrefecture?: string;
  compact?: boolean;
  variant?: SearchVariant;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(defaultQuery);
  const [prefecture, setPrefecture] = useState(defaultPrefecture);
  const [items, setItems] = useState<SearchItem[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const showPrefecture = !compact && variant !== "hero";
  const showSuggestions = isFocused && items.length > 0;
  const searchUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (prefecture) params.set("prefecture", prefecture);
    return `/municipalities${params.toString() ? `?${params.toString()}` : ""}`;
  }, [query, prefecture]);

  useEffect(() => {
    let cancelled = false;
    const q = query.trim();
    if (q.length < 1) {
      setItems([]);
      return;
    }
    const timer = setTimeout(() => {
      const needle = normalizeSearchText(q);
      loadSearchIndex()
        .then((allItems) => {
          if (cancelled) return;
          setItems(allItems.filter((item) => [
            item.municipalityName,
            item.municipalityNameKana,
            item.prefectureName,
            item.municipalityCode
          ].some((value) => normalizeSearchText(value ?? "").includes(needle))).slice(0, 10));
        })
        .catch(() => undefined);
    }, 180);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  function submit(event: FormEvent) {
    event.preventDefault();
    router.push(searchUrl);
  }

  return (
    <div
      className={clsx(
        variant === "default" && !compact && "panel p-3 sm:p-4",
        variant === "hero" && "hero-command",
        variant === "command" && "search-command"
      )}
    >
      <form
        action="/municipalities"
        onSubmit={submit}
        className={clsx(
          "search-form grid gap-3",
          variant === "hero" && "sm:grid-cols-[minmax(0,1fr)_auto]",
          variant === "command" && "lg:grid-cols-[56px_minmax(0,1fr)_1px_278px_170px]",
          variant === "default" && !compact && "md:grid-cols-[1fr_220px_auto]"
        )}
      >
        {variant === "command" ? (
          <span className="search-command-icon" aria-hidden="true">
            <Search size={44} strokeWidth={1.7} />
          </span>
        ) : null}
        <label className="search-field relative block">
          <span className="search-field-control">
            {variant !== "command" ? (
              <Search
                className={clsx(
                  "absolute left-3 top-1/2 -translate-y-1/2 text-muted",
                  variant !== "default" && "left-4 text-teal"
                )}
                size={variant === "default" ? 18 : 24}
                aria-hidden="true"
              />
            ) : null}
            <span className="sr-only">自治体名を検索</span>
            <input
              name="q"
              value={query}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              onChange={(event) => setQuery(event.target.value)}
              className={clsx(
                "input-control search-input",
                variant === "default" ? "search-input--default" : "search-input--large",
                variant === "command" && "search-input--command"
              )}
              placeholder={variant === "hero" ? "自治体名を入力してください（例：千代田区、横浜市）" : "自治体名、都道府県名、かなで検索"}
            />
            {query ? (
              <button
                type="button"
                className="search-clear-button"
                aria-label="検索語を消去"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  setQuery("");
                  setItems([]);
                }}
              >
                <X size={16} />
              </button>
            ) : null}
          </span>
          {variant === "command" ? <span className="search-field-hint">自治体名、都道府県名、かなで検索</span> : null}
        </label>
        {variant === "command" ? <span className="search-command-divider" aria-hidden="true" /> : null}
        {showPrefecture ? (
          <label className="search-select-field">
            <span className={variant === "command" ? "search-select-label" : "sr-only"}>都道府県</span>
            <select
              name="prefecture"
              value={prefecture}
              onChange={(event) => setPrefecture(event.target.value)}
              className={clsx("input-control", variant === "command" && "search-select--large")}
            >
              <option value="">全国</option>
              {prefectures.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <button
          type="submit"
          className={clsx(
            "button-primary",
            variant === "default" ? "h-11" : "search-button--large px-7 text-sm",
            compact && variant === "default" && "w-full"
          )}
        >
          検索
          {variant !== "default" ? <ArrowRight size={18} /> : null}
        </button>
      </form>
      {showSuggestions ? (
        <div className="search-suggestions mt-3 grid gap-1 border-t border-line/80 pt-3" onMouseDown={(event) => event.preventDefault()}>
          {items.map((item) => (
            <Link
              key={item.municipalityCode}
              href={`/municipalities/${item.municipalityCode}`}
              className="flex items-center justify-between rounded-md px-3 py-2 text-sm transition hover:bg-panel"
            >
              <span className="font-bold text-ink">{item.municipalityName}</span>
              <span className="text-muted">{item.prefectureName}</span>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function normalizeSearchText(value: string) {
  return value.normalize("NFKC").replace(/\s+/g, "").toLocaleLowerCase("ja");
}
