# DeceptionAnalyser
DeceptionAnalyser is a web browser extension that represents a novel solution that leverages large language models to detect markers of deception in PDF documents. It is based on argument schemas made up of premises and critical questions. Premises are a logical framework aimed to conclude whether there is deception. After that, if the premise analysis indicates potential deception, critical questions (CQ) function as diagnostic tools. Large Language Models (LLMs) support this process by making a first assessment and providing pieces of evidence from the documents that support their assessment. For CQs, it instantiates the questions proposed in the argument schema for the target document and answers them providing also pieces of evidence and arguments and counter-arguments.

## Schema-Driven Analysis Framework
The foundation of DeceptionAnalyser's analytical approach lies in its flexible argument schema system. Schema selection influences what the LLM evaluates, guiding it to focus on different aspects of potential deception based on the specific context and requirements of the analysis.
The tool offers a dual approach to schema selection. User-created schemas enable domain-specific customization, allowing analysts to tailor the evaluation framework. Conversely, author-proposed schemas offer methodological reliability and serve as benchmarks for consistent analysis. This schema-driven systematization creates analytical frameworks by defining specific premises to evaluate along with corresponding critical questions that probe deeper when deception markers are deteted. 

# END-USERS MANUAL
DeceptionAnalyser supports LLM assisted deception analysis using argument schemas and conducted in a two-stage approach (premises followed by critical questions). After the analysis the tool includes HTML report generation and a Comma-Separated values (CSV) export with all the analysis performed over a set of documents for comparative analysis.

## INSTALLATION AND SETUP
You can follow these steps to get DeceptionAnalysis up and running

### Step 1: Requirements
- Google Chrome browser.
- An OpenAI API key ([You can obtain one here](https://platform.openai.com/api-keys)).

### Step 2: Install the Concept&Go Extension
You can install the extension in your browser from the following link: 
- Open your web browser and navigate to the DeceptionAnalyser extension page on the [[Browser Extension Store/Marketplace](https://chromewebstore.google.com/detail/deceptionanalyser/aejfobdbjdepinlndhecaeahbdbcpjcg?hl=en)].
- Click the "Add to Browser" or "Install" button to begin the installation process.
- Once the installation is complete, you will see a DeceptionAnalyser icon appear in your browser’s toolbar. This indicates that DeceptionAnalyser is successfully installed.

### Step 3: Setup
Once you have installed it, you have to follow these steps:

#### Access to local files

Once you have installed DeceptionAnalyser, you will find the web extension icon in the right part at the top of the toolbar. We recommend pining it in the toolbar to facilitate the use of the tool.

![Screenshot 2022-09-05 at 16 23 01](https://github.com/user-attachments/assets/3f95aedd-50cc-4f71-b14c-6303a309b4d6)

The next step is to prepare the setup to prepare the application before using it. First, in the “Manage extension” menu you have to activate the permission to allow access to local files.

![Screenshot 2022-09-05 at 16 23 13](https://github.com/user-attachments/assets/503f1341-c75d-41f3-89c7-49155e8d617b)

In order to do that, you have to activate the “Allow access to file URLs” option.

<img src="https://github.com/user-attachments/assets/47075f15-c6b9-4ea7-ae0e-66e2c0f8f96b" alt="Screenshot" width="60%">

#### Configure API key

The next step is to configure your OpenAI's or Anthropic's API key to connect the extension with the LLM models. First, you have to access the options panel.

<img width="489" height="544" alt="Screenshot 2025-07-18 at 11 06 05" src="https://github.com/user-attachments/assets/dd726c5c-617e-4666-9b1a-ed2ab3c9373a" />

Once you access the Options menu, you can provide and "Save" the API key.

<img width="1341" height="876" alt="Screenshot 2025-07-18 at 11 07 46" src="https://github.com/user-attachments/assets/fa851fa4-4edc-48c1-b280-256a6ee96a46" />

## GETTING STARTED

### Create First Schema
To start using the tool you can open a PDF file in the web browser. Once the document is opened, you can activate the extension by clicking the pinned icon. When it is activated for the first time, the tool provide different options for creating the argument schema

<img width="859" height="296" alt="Screenshot 2025-07-18 at 11 24 39" src="https://github.com/user-attachments/assets/e70606ad-a413-4225-a346-1b2805a0f526" />

- Create Empty Schema: Allows to create and define the own premises and critical questions. 
- Import Schema from JSON: Allows to import a well-formed JSON exported previously by the tool
- Import Standard Schema: Allows to create a new schema based on the ones integrated in the tool.

Once you create a schema, you have to provide the name and it will be rendered as a highlighter. If it is an empty schema you have to the possibility to add the premises and critical questions dinamically.
 
<img width="825" height="669" alt="Screenshot 2025-07-18 at 12 58 08" src="https://github.com/user-attachments/assets/483f47c3-1dda-4ae9-8345-b08c26d695df" />







