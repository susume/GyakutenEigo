# Homepage layout audit — September 13, 2026

Scope: homepage desktop wrapping, spacing, navigation, mobile reflow, and SpeakCheck App naming.

1. Desktop homepage (1440px): corrected. Before changes, forced breaks and different product heading scales misaligned descriptions and art. Fixed heights and automatic margins added empty space. The subtitle is removed; product headings now use the same scale and shared grid rows align descriptions, media and buttons.
2. Narrow desktop (1024px): corrected. Navigation wrapped into two rows, with controls protruding beyond the header. Explicit flex layout and compact navigation keep it in one row. Step numbers move above copy so step headings fit.
3. Wide desktop (1920px): corrected. Removed the abrupt 1800px typography enlargement and fixed card height. Product names stay on one line and the content remains compact.
4. Mobile (390px): healthy. Balanced headline wraps into two lines; product cards stack and step descriptions wrap naturally. Menu remains available.

Naming: homepage title, navigation, opening button, speaking landing-page heading and accessibility labels use SpeakCheck App. The descriptive phrase “speaking performance” still describes the assessment, rather than naming the application.

Evidence: desktop-1440.png and mobile-390.png captured from the local app during this audit. Desktop screenshots were inspected directly in the browser. No horizontal overflow was visible at inspected widths. Visual inspection does not establish screen-reader or full WCAG compliance.

final result: passed
