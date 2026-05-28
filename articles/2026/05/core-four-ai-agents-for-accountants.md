---
title: "The Core Four Framework for Building AI Agents in Accounting"
date: 2026-05-28
tags: [Accounting, AI Agents, Automation]
excerpt: "A practical way for accountants to think about AI agents: model, context, prompt, and tools, with examples for transaction matching and variance commentary."
---

I've been spending more time thinking about how accountants should build AI agents, and there is one framework I keep coming back to: the Core Four.

I first saw this framework from IndyDevDan on YouTube, so credit goes there. His content is more engineering-focused, but the idea maps cleanly to accounting. If you are trying to build agents that help with reconciliations, transaction matching, variance commentary, reporting, or other finance workflows, you need a simple way to understand what makes the agent work.

The Core Four is:

1. **Model**
2. **Context**
3. **Prompt**
4. **Tools**

This post is a little more theoretical than the hands-on examples, but the theory matters. If an accounting agent gives you a bad result, you need to know whether the problem was the model, the context, the prompt, the tools, or some combination of all four.

## 1. Model: the brain of the agent

The model is the AI engine behind the agent.

It is the thing doing the reasoning, reading, summarizing, classification, and judgment-like work. The specific model names will change over time, so I would not anchor the whole workflow to one vendor or version. The more important point is this: the model needs to be strong enough for the work you are asking it to do.

For accounting, that matters. A weak model may struggle to read messy transaction memos, understand account relationships, or explain a variance in a way that actually makes sense. A stronger model is much more likely to reason through the work, ask better follow-up questions, and recover when the first attempt is imperfect.

The model is not the whole agent, though. It is just one part of the system.

## 2. Context: the job description

Context is the background information the agent needs before it can do the job well.

I think about context like a job description. If you were hiring someone into an accounting role, you would tell them what company they are working for, what processes they are responsible for, what systems matter, how the chart of accounts is structured, what abbreviations people use, and what good work looks like.

An AI agent needs the same thing.

For an accounting workflow, context might include:

- The business or entity the agent is working on
- The chart of accounts
- Common account mappings and abbreviations
- Close calendar expectations
- Examples of good and bad variance commentary
- Reconciliation rules by account
- Known system limitations
- Prior month patterns or recurring entries

This is where accountants have a real advantage. We already understand that process knowledge matters. The agent cannot infer every internal convention from a vague instruction. If the business calls something by an odd abbreviation, if a fee always maps to a specific GL account, or if a reconciliation has a special rule, that context needs to be written down.

The more specific the context, the better the agent usually performs.

## 3. Prompt: the direct instruction

Prompting is different from context.

Context sets the scene. The prompt tells the agent what to do.

For example, context might explain how a reconciliation should work. The prompt is the specific request:

> Run the cash reconciliation for January 31 and explain any variance between the GL and the bank statement.

That distinction matters. A lot of people put too much pressure on the prompt alone. The prompt is important, but it is not magic. If the agent has no business context and no access to the right data, even a well-written prompt can only go so far.

Still, a good prompt helps reduce ambiguity. It should be specific about the task, the date range, the entity, the output format, and the level of explanation you want.

For accounting work, a useful prompt often includes:

- The exact task
- The entity or account
- The date or period
- The source documents or systems to use
- The expected output format
- Any review or tie-out requirements

Think of the prompt as the action verb: go reconcile this, go analyze that, go classify these transactions, go draft this commentary.

## 4. Tools: how the agent gets work done

Tools are what allow the agent to interact with systems, files, scripts, and data.

This is where the agent stops being a chatbot and starts becoming part of a workflow. A tool might be an MCP connector, a Python script, a database query, a CLI, a PDF reader, or an API connection to an accounting system.

For accountants, tools are going to matter a lot because so much of our work depends on getting data out of systems.

An agent might need to:

- Pull transactions from a bank or credit card platform
- Query a general ledger
- Read a bank statement PDF
- Connect to QuickBooks, Digits, or another accounting system
- Run a script that calculates variances
- Export a finished reconciliation to Excel

The model can reason, but it still needs access to the work. Without tools, it is mostly limited to whatever you paste into the chat. With tools, it can start operating against the same systems and files accountants already use.

## Example: transaction matching

Take a transaction matching or reconciliation agent.

The Core Four might look like this:

**Model:** You want a model strong enough to read transaction descriptions, vendor names, memos, and imperfect text.

**Context:** You give the agent rules for how the business classifies common transactions. For example, when it sees a certain service fee memo, it should know which GL account to use.

**Prompt:** You tell it to reconcile a specific account for a specific date and identify any unmatched items.

**Tools:** You give it access to the bank transactions, the GL activity, and any scripts or connectors needed to compare the two.

That is the point where the framework becomes practical. If the agent gets the wrong result, you can diagnose the issue. Maybe the model was not strong enough. Maybe the context was missing an account mapping. Maybe the prompt was vague. Maybe the tool pulled the wrong date range.

That diagnosis is how you improve the workflow.

## Example: variance commentary

Variance analysis is another good example.

A good variance comment usually needs more than one layer of explanation. I have always thought about it as two whys:

1. Why did the number change?
2. Why did that reason happen?

For an AI variance agent, the Core Four might look like this:

**Model:** The model needs to write clearly and reason through the explanation.

**Context:** You define what a good variance comment looks like, what a bad one looks like, which departments or accounts matter, and where the agent should look for supporting detail.

**Prompt:** You ask it to run the variance analysis and return the comments in the format your team uses.

**Tools:** The agent pulls the P&L, calculates the variance, and reads whatever supporting detail is available.

Again, the framework helps you see the system. Variance commentary is not just "ask AI to explain the numbers." The agent needs the model, the background, the instruction, and the tools to get to a useful answer.

## Why this matters for accountants

The line between accounting and engineering is moving closer to the middle.

That does not mean accountants need to become full-time software engineers. But it does mean we need better mental models for how these systems work. AI agents are not just a novelty layer on top of accounting. Used well, they can become part of reconciliations, reporting, close support, review workflows, and analysis.

The Core Four gives accountants a practical way to think about that.

When an agent works, you can understand why. When it fails, you have a way to troubleshoot. And when you are designing a new workflow, you can ask the right questions:

- Is the model capable enough for this task?
- Have we given it enough context?
- Is the prompt specific enough?
- Does it have the tools required to do the work?

That is a much better starting point than treating AI agents like a black box.

If you want more background on how this shows up in actual accounting workflows, start with my earlier posts on [Claude Code for accountants](/articles/2026/02/claude-code-for-accountants-getting-started) and [automated reconciliation](/articles/2026/02/claude-code-reconciliation-in-action).

The practical work is still the same: understand the process, know where the data lives, define what good output looks like, and build the workflow carefully. The agent just gives us a new way to put those pieces together.

If you are working through this inside your own accounting function, the [resources](/resources) page is where I will keep adding prompts, templates, examples, and workflow guides. For more direct help applying these ideas, [coaching](/coaching) is available as well.

-Bennett
