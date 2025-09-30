# Sheet Wizard

_Shape spreadsheet data into charts and insights_

![Build Without Boundaries](https://img.shields.io/badge/KendoReact-Challenge-blue) ![Vite](https://img.shields.io/badge/Vite-✅-pink) ![Tailwind](https://img.shields.io/badge/Tailwind-✅-06b6d4)

## Short description

Upload CSV / XLSX files, perform quick analyses, and build custom charts. UI powered by **KendoReact Free** components + Recharts (charts). Built with Vite, React, and TailwindCSS.

> Note: This submission uses **10+ KendoReact Free components** to meet the KendoReact Free Components Challenge requirements. (Challenge runs through **September 28, 2025**.) :contentReference[oaicite:14]{index=14}

## Live demo

- [Demo](https://www.loom.com/share/1382adaea79e41e09406bc76caecb3a7?sid=6bc8ff72-ec35-4f9a-b8fa-a67471f236c4)

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

- **Charts** (`@progress/kendo-react-charts`) - Data visualization with:
  - `PieChart` - Proportional data representation
  - `BarChart` - Categorical comparisons
  - `AreaChart` - Trend analysis over time
  - `DonutChart` - Proportional data with center metrics
  - `LineChart` - Continuous data trends

- **Inputs** (`@progress/kendo-react-inputs`) - Form controls:
  - `Input` - Text and data entry fields

- **Buttons** (`@progress/kendo-react-buttons`) - User interactions:
  - `Button` - Primary action triggers

- **Labels** (`@progress/kendo-react-labels`) - Form validation:
  - `Error` - Validation error display

- **Layout** (`@progress/kendo-react-layout`) - Data display and structure:
  - `Card` - Container for displaying content
  - `CardTitle` - Title section for the card
  - `CardBody` - Main content area of the card
  - `CardActions` - Action buttons or elements in the card

- **Chart Wizard** (`@progress/kendo-react-chart-wizard`) - Edit charts with:
  - `ChartWizard` - Wizard component for chart editing and configuration

- **Animation** (`@progress/kendo-react-animation`) - Components animation with:
  - `Reveal` - Animation component for revealing content with effects

**NEW

- **Tooltip** (`@progress/kendo-react-tooltip`) - Components tooltip with:
  - `Tooltip` - Tooltip component for showing some texts

- **Progress Bar** (`@progress/kendo-react-progressbars`) - Components progress bar with:
  - `ProgressBar` - Progress Bar component responsible for some loading screens

- **Skeleton** (`'@progress/kendo-react-indicators`) - Components skeleton for:
  - `Skeleton` - All charts will load with a skeleton before showing the data

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
```

## How this submission meets the challenge

* Uses **10+ free KendoReact components** listed above (see "KendoReact components used"). ([Telerik.com][2])
* Accessibility: components are keyboard navigable, has aria labels and color contrast checks.
* Usability: minimal flows (upload → preview → select axes → render chart) and tooltips + help modal.
* Creativity: custom chart presets, column smart-detection (dates, numbers), quick analysis panels.

## Bonus categories

* **Code Smarter, Not Harder**: I used the KendoReact AI Coding Assistant for quick code scaffolding of the Grid integration and some form components (describe exact areas you used it in your submission).

## Libraries & credits

* KendoReact Free — 50+ free UI components. ([Telerik.com][2])
* `xlsx` for client-side spreadsheet parsing

## Contributing

PRs welcome. Open an issue if you want features or find bugs.

## License

MIT — / © `Matheus D. Santos` — feel free to use code in your demos / portfolio.

```

---
