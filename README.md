# Sheet Wizard

*Shape spreadsheet data into charts and insights*  

![Build Without Boundaries](https://img.shields.io/badge/KendoReact-Challenge-blue) ![Vite](https://img.shields.io/badge/Vite-✅-pink) ![Tailwind](https://img.shields.io/badge/Tailwind-✅-06b6d4)

## Short description

Upload CSV / XLSX files, perform quick analyses, and build custom charts. UI powered by **KendoReact Free** components + Recharts (charts). Built with Vite, React, and TailwindCSS.

> Note: This submission uses **10+ KendoReact Free components** to meet the KendoReact Free Components Challenge requirements. (Challenge runs through **September 28, 2025**.) :contentReference[oaicite:14]{index=14}

## Live demo

- Demo: `<DEMO_URL>` (I need to add this later)

## Features

- Upload local CSV / XLSX (client-side parsing using `xlsx` library)
- Display and edit data in a Kendo **Grid** (sorting, filtering, pagination)
- Select columns to visualize using Kendo **ListBox** / **DropDowns**
- Build custom charts (bar/line/pie) using Recharts (or Chart.js)
- Save chart presets (ChipList + Toolbar)
- Date-based filters (DatePicker)
- Accessible keyboard-first UI (Kendo components + aria labels)
- Export filtered table to CSV / Excel

## KendoReact components used (examples — 10+)

- Grid (`@progress/kendo-react-grid`) — table visualization. :contentReference[oaicite:15]{index=15}
- Input / NumericTextBox / RadioButton / Checkbox (`@progress/kendo-react-inputs`). :contentReference[oaicite:16]{index=16}
- Button, ButtonGroup, ChipList, Toolbar (`@progress/kendo-react-buttons`). :contentReference[oaicite:17]{index=17}
- DropDownList / ComboBox (`@progress/kendo-react-dropdowns`). :contentReference[oaicite:18]{index=18}
- DatePicker / DateInput (`@progress/kendo-react-dateinputs`). :contentReference[oaicite:19]{index=19}
- ListBox (`@progress/kendo-react-listbox`) — choose chart axes. :contentReference[oaicite:20]{index=20}
- Pager (data tools) — grid paging. :contentReference[oaicite:21]{index=21}

> Note: Kendo **Charts** and **Upload** are premium components; I used Recharts for chart rendering and a simple client-side file input + `xlsx` parsing to avoid the premium Upload dependency. :contentReference[oaicite:22]{index=22}

## Getting started (dev)

```bash
# 1) clone
git clone https://github.com/MatheusDSantossi/data-analyses-automate.git

cd data-analyses-automate

# 2) install dependencies
npm install

# 3) run dev server
npm run dev

## Build / Deploy

npm run build
# Deploy `dist/` to <.>

## How this submission meets the challenge

* Uses **10+ free KendoReact components** listed above (see "KendoReact components used"). ([Telerik.com][2])
* Accessibility: components are keyboard navigable, has aria labels and color contrast checks.
* Usability: minimal flows (upload → preview → select axes → render chart) and tooltips + help modal.
* Creativity: custom chart presets, column smart-detection (dates, numbers), quick analysis panels.

## Bonus categories

* **Code Smarter, Not Harder**: I used the KendoReact AI Coding Assistant for quick code scaffolding of the Grid integration and some form components (describe exact areas you used it in your submission).

## Libraries & credits

* KendoReact Free — 50+ free UI components. ([Telerik.com][2])
* Recharts (charts) or Chart.js (choose one) for charting
* `xlsx` for client-side spreadsheet parsing

## Contributing

PRs welcome. Open an issue if you want features or find bugs.

## License

MIT — / © `Matheus D. Santos` — feel free to use code in your demos / portfolio.

```

---
