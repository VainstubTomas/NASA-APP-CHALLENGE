> 🇪🇸 [Leer en español](../07-DESAFIO-OFICIAL.md)

# 07. Official challenge text (English)

Source: https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/ (copied 2026-11-13).

> Note: the Spanish version in `../07-DESAFIO-OFICIAL.md` was itself a machine translation of the English original. This English text is a back-translation of that Spanish file, not a verbatim copy of the organizers' page. For the exact wording, check the source URL. This document is a reference: it is not edited. The analysis against our scope is in `00-CONTEXT.md`.

**It does not include evaluation criteria.** The global Space Apps awards and the award we aim for are in `00-CONTEXT.md`, section "Awards" (ADR-012). Resources are in `00-CONTEXT.md` and in ADR-006.

---

Missions to the lunar south pole face extreme limits on illumination and communication, and their planning requires careful coordination between science and engineering teams. Tools exist to determine the positions of the Sun and the Earth at possible landing sites, but their complex interfaces make it hard to efficiently evaluate crucial information. Your challenge is to create an intuitive tool or application that lets mission planners, educators and the public quickly compare landing sites and dates, visualizing the positions of the Sun and the Earth relative to the horizon to assess the potential for power generation and the windows of direct communication with the Earth.

## Background
NASA's Commercial Lunar Payload Services (CLPS) program and other lunar missions depend on carefully selecting landing sites and dates that balance the needs of science and engineering teams. One of the most important challenges in this process is understanding the local lighting and communication environment at a possible landing site. The Sun's position determines the power available to solar panels and the thermal conditions for the equipment, while the Earth's position determines whether direct communication without relay satellites is possible.

This challenge is especially pressing at the lunar south pole, where many future missions are planned because of the presence of water ice and other resources of great scientific value. The geometry of the south pole produces extreme variations in solar illumination and Earth visibility across different lunar days and seasons. Small changes in the landing location or date can drastically affect both power generation potential and communication windows, which makes rapid site evaluation essential.

In practice, mission development rarely follows a fixed schedule. Hardware development challenges, launch delays and other factors often force mission planners to reconsider the original landing date and place. When this happens, engineers need to quickly evaluate alternative sites in the same region, or alternative dates at the same site, to understand how these changes affect mission feasibility. A tool that enables quick, intuitive comparison of multiple scenarios would speed up this decision-making and help teams identify viable alternatives when constraints change.

The tools that provide this information, such as NASA's Quickmap, Moon Trek and JPL's Horizons System, are designed for detailed analysis and are often hard to use effectively for non-specialists who need to quickly compare different scenarios. Evaluating each combination of site and data means navigating multiple interfaces and interpreting raw data. This creates a gap between the technical data available and the accessible tools needed for agile mission planning. An intuitive interface that turns complex topographic and ephemeris data into clear, comparable visualizations could help close this gap.

## Objectives
Your challenge is to create a tool or application that lets users quickly evaluate lunar landing options. Your solution may include:

- **Interactive site selection and comparison**: Consider letting users choose from a curated list of landing sites, such as past Apollo missions, targets of future CLPS missions, targets of other commercial lunar missions, or landing sites of other countries' lunar programs, as well as the option to enter custom lunar coordinates. You may also consider enabling simultaneous or sequential comparison of several sites to help users quickly weigh the pros and cons.
- **Date and time flexibility**: Consider letting users select landing dates and times, and provide tools to explore how conditions change across different days or lunar seasons. This lets users understand how adjustments to the mission schedule affect its feasibility.
- **Visualization of the Sun and Earth positions**: Show the positions of the Sun and the Earth relative to the horizon at a selected landing site and on a given date. You may consider showing how long until sunset, since this directly affects mission operations and power generation windows.
- **Energy and communications assessment**: Consider highlighting key indicators such as the solar elevation angle (which affects power generation efficiency), the duration of sunlight, and the Earth visibility windows. These indicators help mission planners quickly assess whether a site and date combination is viable.
- **Diverse visualization approaches**: You may explore 2D maps, 3D surface visualizations or other creative representations that help users understand the spatial relationships between the landing site, the Sun and the Earth.
- **Temporal dynamics**: You may consider creating animations or timeline views that show how the positions of the Sun and the Earth change over a lunar day or several days, helping users understand the duration and timing of operational windows.
- **Accessibility for all skill levels**: Your tool could be useful for mission planners who need detailed technical information for quick decisions, as well as for educators and the general public who are curious about why the Moon presents such particular engineering challenges.

We encourage you to be creative in presenting this information. Your solution could be a web app, a mobile app, an interactive visualization, an educational game or any other format, as long as it enables quick and efficient evaluation of the site.

## Potential considerations
You can (but are not required to) consider the following:

**Technical approach:**
- Ephemeris data (the positions and motions of celestial bodies) can be calculated with tools such as JPL's Horizons System, or precalculated datasets can be used.
- Lunar topography data from sources such as the Lunar Orbiter Laser Altimeter (LOLA) can help create realistic surface visualizations and accurate horizon calculations.
- Consider how to handle the Moon's lack of atmosphere when calculating the horizon position. Without atmospheric refraction, the horizon is determined by the local terrain and the edge of the lunar sphere as seen from the landing site.
- The solar elevation angle is a key metric for power generation, and it is worth calculating and displaying it prominently.

**User experience:**
- Your interface could prioritize quick comparison of scenarios, letting mission planners efficiently evaluate multiple site and date combinations.
- Consider how to clearly communicate the time remaining before sunset or Earth set, since this is critical operational information.
- Think about how to make the extreme differences between lunar and terrestrial conditions evident; they can be fascinating when visualized effectively.
- You could consider features that help users understand why small changes in location or date have a large impact on mission feasibility.

**Data and accuracy:**
- Consider the Moon's real topography, since terrain elevation can significantly affect the horizon position and visibility windows.
- Consider whether your tool will account for factors such as libration (the Moon's wobble) or the Moon's orbital variations.
- The south pole terrain is especially complex, and it is worth considering how to represent steep slopes and deep craters that create extreme shadow conditions.

**Commitment and impact:**
- Your solution could help mission planners coordinate science and engineering teams during mission development.
- It could help teams respond quickly when schedule changes or hardware development challenges require adjustments to the landing date or site.
- It could also serve as an educational tool to help students and the general public understand the challenges of lunar exploration and why mission planning is so complex.

For data and resources related to this challenge, see the Resources tab at the top of the page. More resources may be added before the hackathon begins.
