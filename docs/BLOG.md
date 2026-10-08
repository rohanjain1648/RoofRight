# The Roof Nobody Owns: Building a Solar Desk for Indian Housing Societies with Strands, Cedar, SAM and LocalStack

*How I turned an electricity bill into a solar application pack, kept the AI away from the maths, and ran the whole thing on my laptop.*

<!-- IMAGE 1 (hero): wide screenshot of the results screen. The roof drawn as an SVG with solar panels on it, the sun in the corner. Alt text: "RoofRight results screen showing a rooftop filled with the solar panels a housing society needs." -->

Tags: `AWS` `Strands Agents` `Cedar` `AWS SAM` `LocalStack` `Solar` `India` `Sustainability` `Hackathon`

---

## A meeting that never ends

Picture a housing society meeting in any Indian city. Someone raises rooftop solar. Heads nod. Everyone likes lower bills and a smaller carbon footprint. Then the questions start:

- *Whose roof is it, exactly?*
- *How many of us need to agree?*
- *What size system? What will it cost after subsidy? When do we get the money back?*
- *Who writes the resolution? Who asks vendors for quotes?*

Nobody has the answers, so nobody moves. The secretary, usually a volunteer with a day job, is left to assemble it all.

The subsidy scheme exists. PM Surya Ghar offers support for rooftop solar. But the reported figures show a large drop between interest and installation: only around 22.7% of applications become completed installations, with financing, vendor capacity and approvals named as the bottlenecks ([IEEFA](https://ieefa.org/resources/residential-rooftop-solar-grows-under-pm-surya-ghar-yojana-gaps-persist)). For apartments there's an extra wall. In Chandigarh, resident associations have flagged unresolved roof rights as a blocker for tens of thousands of flats ([Tribune](https://www.tribuneindia.com/news/chandigarh/rwas-flag-roof-right-hurdle-blocking-solar-adoption-in-60000-chb-flats)).

I built **RoofRight** for the Waste and Energy track of Environmental Hacks. It aims at one narrow thing: getting a society from "we're curious" to a document pack it can take to its general body meeting, in minutes.

I want to be straightforward about scope. It's a planning tool, not an engineering design and not legal advice. It doesn't replace a structural engineer or an empanelled vendor. What it replaces is the blank page.

## What a secretary actually does

Five steps, one screen each, in English or Hindi, designed for a phone.

**1. Bill.** Upload a photo of the electricity bill. The app reads units, rate and sanctioned load, then shows every value for the user to confirm. Anything the model is unsure about is highlighted.

<!-- IMAGE 2: screenshot of the bill step with one low-confidence field highlighted in marigold. Alt text: "Bill upload screen with an extracted value flagged for double-checking." -->

**2. Roof.** Tap the corners of the terrace on a map. The area is computed from the outline. Or just type it. Then set how much shade the roof gets.

<!-- IMAGE 3: screenshot of the map with a drawn polygon and the measured area. -->

**3. Society.** How many flats, how many members have agreed, who has the right to use the roof, whether a structural engineer has certified it.

**4. Results.** The system drawn as panels on your roof, plus cost, subsidy, payback and carbon avoided. Then the part I care about most: a plain list of what's blocking the application and how to fix each item.

**5. Pack.** A consent resolution and a vendor quotation request, as PDFs ready to print. Plus a chat where you can ask, "What's blocking us?"

<!-- IMAGE 4: side-by-side of the two generated PDFs. -->

## The decision that shaped everything: the model never does the maths

It's tempting to hand a language model the whole flow. Bill in, answer out. For solar sizing that would be a mistake, because the output is a number a committee will use to decide whether to spend lakhs of rupees. A fluent wrong answer is worse than no answer.

So RoofRight splits the work:

- **Deterministic Python** does sizing, generation, subsidy, payback and CO₂. It's a few hundred lines with tests: roof-limited, demand-limited and load-limited cases, subsidy caps, and bad input.
- **The language model** does two things. It reads the bill, and it explains the results in plain words. When it explains, it has to call tools that return the engine's numbers. It can't invent one.

Every number on the results screen can be reproduced by the engine, and the assumptions (sunshine yield for the city, how much of the roof is usable, shading, installed cost, tariff rise, panel ageing) sit in a panel on the same screen. If someone disagrees with an assumption, they can see exactly which one.

## Where AWS open source fits

I built this on the "Build It" side of the hackathon: open-source AWS tools on my own machine, no account, no bill. Four of them carry real weight.

### Strands Agents SDK: the agent and the bill reader

Strands is an SDK for building agents around tools. I used it twice.

For the **chat agent**, I wrap the engine in tools: get the case summary, check blockers, and two "what if" tools (a different system size, a different level of consent). The agent answers by calling them. Each tool is closed over one society's case, so the agent can only read and compute for that case.

For **bill reading**, a Strands agent with a local vision model returns a structured object (units, rate, load, total). I validate every field against plausible ranges, because a bill reader that says a flat used 99,999,999 units should be caught by code, not trusted.

Because Strands defaults to Bedrock and I wanted zero cost, I used its Ollama provider with small local models. The model id is an environment variable, so moving to a Bedrock model later is a config change.

**A fallback chain instead of a hope:** vision model → OCR with a regex parser → typing it in. And if the chat model isn't available, a rule-based answerer explains the case from the same data. The flow works with no LLM at all, and the LLM makes it nicer.

### Cedar: rules that belong to the society, not the code

The "what's blocking us" list isn't an `if` chain in my backend. It's evaluated by **Cedar**, the AWS open-source policy language.

Each gate is a Cedar authorization request over the case. Here's a real one from the repo:

```cedar
@id("consent-majority")
permit (principal, action == Action::"CheckConsent", resource)
when { resource.consent_pct >= 51 };

@id("roof-right-disputed-forbid")
forbid (principal, action == Action::"CheckRoofRight", resource)
when { resource.roof_right == "disputed" };
```

The same mechanism decides who can do what: only the secretary can approve the resolution, only the secretary or the roof owner can submit, and only with enough consent.

Why Cedar and not code? Because societies differ. One's by-laws require two thirds, another's require the treasurer's sign-off. Rules as data means those can change without touching the app, and the policy file can be read and argued about by non-programmers. It's a natural fit for authorization-shaped problems.

**A gotcha worth sharing:** Cedar has no floating-point type. My first version passed the sanctioned load as a float, and the whole request quietly evaluated to "deny". Every gate failed, even the ones that only compared strings. The fix was to represent sizes as integer deci-kilowatts, rounding the system size up and the load down so the check stays conservative. If you're moving numeric data into Cedar, decide your units up front.

### AWS SAM CLI and LocalStack: a real serverless shape, locally

The backend is a set of Lambda handlers behind API routes, described in a SAM template and run with `sam local start-api`. State lives in **LocalStack**: cases in DynamoDB, generated PDFs in S3.

I also wrote a tiny adapter that serves the same handlers over plain HTTP, so I can iterate quickly without Docker, and use SAM for the real run. The handlers are identical either way. Storage falls back to memory if LocalStack isn't reachable, which keeps the tests fast and the demo resilient.

<!-- IMAGE 5: terminal screenshot: SAM local request log on the left, `awslocal s3 ls` showing the generated PDFs on the right. Alt text: "Local Lambda requests handled by SAM and the generated PDFs stored in LocalStack S3." -->

## The part I'm proudest of: a roof you can see

Most calculators end in a big number. I wanted the result to feel like the society's own roof. So the results screen draws the terrace and fills it with the exact number of panels the system needs, with spare space shown as dashed outlines. Change the shading or the roof area, and the array changes.

It's an SVG, not an image, so it scales to a phone, respects light and dark mode, and reads clearly to a screen reader through its label. It also turns an abstract "6.6 kWp" into "this many panels, on this roof", which is what a committee actually argues about.

<!-- IMAGE 6: two states of the roof array: roof-limited vs demand-limited, showing spare slots as dashed outlines. -->

## Designing for the person, not the demo

The user here is a volunteer secretary on a phone, often more comfortable in Hindi. That drove a few choices:

- **Two languages from the start**, not translated at the end. All interface text is in both, including the blockers.
- **Sentence-case, plain verbs.** "Build my solar pack", not "Submit".
- **Blockers explain the fix.** "Fewer than 51% of members have consented. Circulate the resolution and collect signatures." is more useful than a red X.
- **Honest about uncertainty.** The subsidy amounts are held in a config file with a source URL and a "verified" date. Until someone checks them against the official portal, the screen shows a warning. I'd rather ship a visible caveat than a confident wrong number.

## What I learned

1. **Constrain the model with tools, and keep arithmetic out of it.** The best thing I did for trustworthiness was refusing to let the LLM produce a figure.
2. **Design the failure path first.** Every AI step has a fallback that works without AI.
3. **Policy-as-data changes how you think.** Once the rules were in Cedar, "what's blocking us?" stopped being a feature and became a query.
4. **Local-first is a real option.** The full serverless shape (Lambda-style handlers, DynamoDB, S3, an agent) ran on a laptop.
5. **Tools change under you.** Strands' older `structured_output` call is deprecated in favour of passing a `structured_output_model` on invocation. Checking the version you have installed beats trusting a tutorial.

## What it doesn't do (yet)

- Subsidy figures still need verification against the official portal, and the app says so.
- No satellite roof detection; the user draws the roof.
- No live vendor or DISCOM integration.
- The estimates are for planning, and a structural engineer and an empanelled vendor are still required.

**Where I'd take it next:** society-specific policy packs (upload your by-laws, get your Cedar rules), Bedrock models for stronger bill reading, and a shared dashboard that lets neighbouring societies compare.

## Results

`[Fill in only what you measured: e.g. how many sample bills you tested, how many were read correctly by vision vs OCR, how long the flow took from upload to PDFs, test counts. Delete this section if you didn't measure.]`

## Try it

- Code: `[GitHub link]`
- Demo (3 minutes): `[YouTube link]`

Built with the Strands Agents SDK, Cedar, AWS SAM CLI and LocalStack, with React and TypeScript on the front. Code was written with the help of Claude Code and reviewed and tested by me.

---

*Built for Environmental Hacks (Bharat Builds Tour, Event 02).*
