# 🪐 OneChat | Next-Gen Local AI Reasoning Ecosystem

A production-grade, private-first AI interface engineered to leverage the full power of local Large Language Models (LLMs). OneChat combines an elite, fluid UI inspired by world-class AI platforms with a secure, local-only architecture.

###  

## 🚀 Key Features

  * **Reasoning Engine Native**: Specifically optimized for "Thinking" models (GPT-OSS 20B / Qwen 2.5 14B). Features dynamic `<think>` tag parsing with collapsible UI components.
  * **Jarvis Voice Protocol**: Native **Web Speech API** integration for real-time voice-to-text dictation with animated visual feedback.
  * **Agent Multiverse**: Hot-swappable AI personas (**Core**, **Nexus Dev**, **Muse**) with specialized system prompts for distinct engineering and creative workflows.
  * **Massive Context Support**: High-performance context management up to **256k tokens**, allowing for deep discussion of entire codebases.
  * **Multimodal Artifacts**: Premium drag-and-drop support for visual context (Images) and system documentation (.ts, .env, .py, .json, .tsx).
  * **Enterprise Document Suite**: Instant **PDF E-Report** generation and Markdown exporting for professional documentation.
  * **Premium UX**: Titanium design system featuring skeleton loading, glassmorphic overlays, and **60FPS Framer Motion** animations.

## 🛠️ Tech Stack

**Frontend & Logic:**

  * **Next.js 15 (App Router)**: High-performance React framework.
  * **Tailwind CSS**: Premium, fluid utility-first design.
  * **Framer Motion**: Complex micro-interactions and layout transitions.
  * **Lucide React**: Enterprise-grade iconography.
  * **Prism.js**: Real-time syntax highlighting for code artifacts.

**Backend & Inference:**

  * **Ollama**: Local inference engine for private model hosting.
  * **Next.js API Routes**: Secure internal bridge to local inference servers.
  * **Web Speech API**: Browser-native transcription services.

## ⚙️ Local Setup

### System Prerequisites

Ensure **Ollama** is installed and the service is active:

```bash
ollama serve
```

### Application Setup

1.  **Navigate & Install**:

    ```bash
    git clone https://github.com/chiranjeeb-lahiri/OneChat.git
    cd OneChat
    npm install
    ```

2.  **Launch Ecosystem**:

    ```bash
    npm run dev
    ```
