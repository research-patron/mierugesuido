"use client";

import { useEffect, useState } from "react";

type GisFeature = {
  code: string;
  name: string;
  path: string;
};

type GisData = {
  viewBox: {
    width: number;
    height: number;
  };
  prefectures: GisFeature[];
};

export function HomeHeroVisual() {
  const [data, setData] = useState<GisData | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/gis/mlit-n03-simplified.json")
      .then((response) => {
        if (!response.ok) throw new Error("GIS data unavailable");
        return response.json();
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="home-visual-shell" role="img" aria-label="日本地図、水流、下水処理施設を表すビジュアル">
      <svg className="home-visual-illustration" viewBox="0 0 700 380" aria-hidden="true">
        <defs>
          <pattern id="homeJapanDots" width="7" height="7" patternUnits="userSpaceOnUse">
            <circle cx="2.7" cy="2.7" r="2.35" fill="#0799aa" />
          </pattern>
          <linearGradient id="homePlantFill" x1="0" x2="1" y1="0" y2="1">
            <stop stopColor="#c6eff5" />
            <stop offset="1" stopColor="#eaf9fb" />
          </linearGradient>
          <linearGradient id="homeWaveFill" x1="0" x2="1" y1="0" y2="0">
            <stop stopColor="#ffffff" stopOpacity="0" />
            <stop offset=".45" stopColor="#bcebf2" stopOpacity=".55" />
            <stop offset="1" stopColor="#dff7fa" stopOpacity=".8" />
          </linearGradient>
        </defs>

        <g className="hero-water-lines">
          <path d="M0 176 C150 142 228 238 380 196 C510 160 586 202 700 156" />
          <path d="M0 191 C150 148 228 240 380 204 C510 164 586 205 700 163" />
          <path d="M0 206 C150 154 228 242 380 212 C510 168 586 208 700 170" />
          <path d="M0 221 C150 160 228 244 380 220 C510 172 586 211 700 177" />
          <path d="M0 236 C150 166 228 246 380 228 C510 176 586 214 700 184" />
          <path d="M0 251 C150 172 228 248 380 236 C510 180 586 217 700 191" />
          <path d="M0 266 C150 178 228 250 380 244 C510 184 586 220 700 198" />
          <path d="M0 281 C150 184 228 252 380 252 C510 188 586 223 700 205" />
        </g>

        <circle cx="272" cy="82" r="36" fill="#ffffff" stroke="#d9eef4" />
        <path d="M272 58a24 24 0 1 1-17.2 40.8l12.6-12.6A7 7 0 1 0 272 75V58Z" fill="#91d9e0" />

        {data ? (
          <g className="home-japan-map" transform="translate(44 -38) scale(.54)">
            {data.prefectures.map((feature) => (
              <path
                key={feature.code}
                d={feature.path}
                fill="url(#homeJapanDots)"
                fillRule="evenodd"
                stroke="#ffffff"
                strokeWidth="1.2"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </g>
        ) : (
          <g className="home-japan-map home-japan-map--fallback">
            <path d="M434 64C484 104 504 168 474 220C445 270 376 293 320 267C267 243 259 180 289 132C321 81 382 47 434 64Z" fill="url(#homeJapanDots)" />
            <path d="M268 246C295 239 323 251 330 274C339 306 299 326 267 311C236 296 234 257 268 246Z" fill="url(#homeJapanDots)" />
          </g>
        )}

        <path d="M46 286C136 269 211 264 304 277C411 293 495 290 630 270L700 380H0L46 286Z" fill="url(#homeWaveFill)" />
        <g className="home-bars">
          <rect x="536" y="150" width="10" height="56" rx="2" />
          <rect x="555" y="130" width="10" height="76" rx="2" />
          <rect x="574" y="112" width="10" height="94" rx="2" />
          <rect x="593" y="90" width="10" height="116" rx="2" />
          <rect x="612" y="122" width="10" height="84" rx="2" />
        </g>
        <g className="home-plant">
          <path d="M526 226L606 196L674 224L595 258Z" fill="url(#homePlantFill)" stroke="#b5e5ee" />
          <path d="M562 222L606 207L642 224L596 240Z" fill="#e8f8fb" stroke="#acdce6" />
          <ellipse cx="583" cy="224" rx="15" ry="8" fill="#0e8ea0" opacity=".75" />
          <ellipse cx="618" cy="224" rx="15" ry="8" fill="#0e8ea0" opacity=".75" />
          <ellipse cx="600" cy="238" rx="15" ry="8" fill="#0e8ea0" opacity=".75" />
          <path d="M568 224H598M606 224H632M585 238H615" stroke="#e9fbfd" strokeWidth="2" />
        </g>
        <path className="home-drop" d="M615 28C594 54 584 74 584 91C584 114 600 128 620 128C641 128 656 113 656 91C656 73 642 53 615 28Z" />
      </svg>
    </div>
  );
}
