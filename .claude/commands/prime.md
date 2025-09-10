# Project Context Priming

To ensure the LLM is always primed with complete and comprehensive project context, follow these steps:

1. **Mandatory Resource Ingestion**

- Ingest every file from the `specs` directory for specifications and requirements, reading each file in its entirety.
- Ingest every file from the `src` directory, and read each file completely.
- Ingest the full content of `README.md` for project overview and usage instructions.
- Ingest the full content of `PROJECT_UNDERSTANDING.md` for a high-level summary of the project and its components.

2. **Analysis & Comprehension**

- Analyze all ingested resources in their entirety to develop a thorough understanding of the project's goals, architecture, coding standards, and requirements.
- Be prepared to answer questions or generate code that strictly follows the project's guidelines and objectives.

3. **Documentation Maintenance**

- Update `PROJECT_UNDERSTANDING.md` to reflect any new insights or changes in project understanding. If the file does not exist, create it.

**Note:**  
Do not modify any files other than `PROJECT_UNDERSTANDING.md`.  
Always prioritize clarity, completeness, and alignment with project standards when summarizing or generating content.
