# RoofRight — 3-minute demo script

Hard limit: **under 3:00**, on YouTube, public or unlisted. Check the link opens signed out. Judges score only the video, so every claim must be visible on screen.

Target: 2:45. Record voice-over separately if the live audio is shaky. Screen at 1080p, browser zoom 110%, phone-width window for the first shot.

## Before recording (checklist)
- [ ] `docker compose up -d` and LocalStack healthy
- [ ] `sam local start-api --env-vars env.json` running in a visible terminal
- [ ] Ollama running, models pulled
- [ ] Frontend at localhost:5173, fresh state, English
- [ ] A sample bill photo ready; its values known
- [ ] Terminal split: SAM logs on one side, LocalStack `awslocal s3 ls` ready
- [ ] Subsidy `retrieved` set after verifying, or the "unverified" note explained aloud

## Script

**0:00 – 0:20 · The problem (talk over the app's first screen)**
> "Every apartment society in India has the same conversation about rooftop solar. Everyone likes it. Then nobody owns the roof, the general body wants numbers, and the secretary is left with paperwork. Only about one in four subsidy applications becomes an installation. RoofRight gets a society from that first conversation to a document pack it can take to its meeting."

On screen: title screen, then the stepper.

**0:20 – 0:55 · Bill → values (the honest AI part)**
> "I start with an electricity bill photo."

Upload the bill. Show the terminal: the Strands agent calling the local vision model.
> "A Strands agent reads it with a local vision model. But I never trust it blindly: every value is shown here for me to confirm, and low-confidence ones are highlighted. If vision fails it falls back to OCR, then to typing it in."

Edit one value on purpose to show it's editable. Continue.

**0:55 – 1:20 · Roof**
> "Then I tap the corners of the terrace. The area is computed from the outline."

Tap 4-5 corners on the map, show the m² appear. Set shading.

**1:20 – 1:40 · Society**
> "Then the questions societies actually get stuck on: who has the right to use the roof, how many members agree, is there a structural certificate."

Choose "Disputed or unclear" on purpose and continue.

**1:40 – 2:20 · Results, the payoff**
> "This is my roof, with the panels the system needs. Cost, subsidy, payback, carbon avoided. And none of this maths comes from the language model. It's deterministic code with tests."

Point to the assumptions panel.
> "The important part is here: what's blocking us. These gates are Cedar policies, the AWS open-source policy language. Roof rights are disputed, so the application is blocked, and it says how to fix it."

Show the Cedar file in a split for 3 seconds. Go back, change to "Society (common terrace)", rebuild: blocker disappears.

**2:20 – 2:45 · Pack + AWS on screen**
> "One click generates the consent resolution and the vendor quotation request."

Click generate, open a PDF for 2 seconds.
> "The files land in S3 and the case in DynamoDB, both on LocalStack, served by Lambda handlers through SAM local."

Cut to terminal: SAM request logs, then `awslocal s3 ls s3://roofright-files --recursive` showing the PDFs.

**2:45 – 2:55 · Chat and close**
> "And I can ask the agent what's still blocking us."

Type the question, show the answer and the tool calls line.
> "RoofRight: from electricity bill to solar application pack. Built on Strands, SAM, LocalStack and Cedar."

## Must be visible (rules: naming AWS in text is not enough)
- Strands agent running (terminal or the "answered by strands+ollama" line)
- SAM local receiving requests
- LocalStack holding S3 objects / DynamoDB item
- Cedar policy file and a gate flipping

## Fallbacks if something breaks on the day
- Model slow: set `ROOFRIGHT_AGENT=rules` and say the chat has a rule-based fallback (true and shown in the code).
- LocalStack down: `ROOFRIGHT_STORE=memory`, but then do not claim S3/DynamoDB in the video.
- Vision model missing: use the sample-bill button or manual entry and say so.

## Do not
- Claim subsidy numbers are verified unless you verified them.
- Show a feature that isn't in the repo.
- Exceed 3:00.
