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

### Start analyzing Premises

The sidebar gather two different spaces for Premises and Critical Questions. Each one contains two different buttons: one for running the analysis and other for creating new premises (or critical questions).

Start by analyzing the Premises. When executed, the tool uses a language model (LLM) to assess the premises and infer a conclusion. The output includes annotations and highlights the most relevant text excerpts from the document. The elements inside the Premises also display a face based on the analysis: green if premises are fulfill and red if not.

<img width="776" height="486" alt="Screenshot 2025-07-18 at 15 29 17" src="https://github.com/user-attachments/assets/6c7202fe-7162-4a0c-9e2d-e0dc8fed03bb" />

If you want to consult the assessment deeply, you can check the answer clicking the right-click in the Premise button and click to show the analysis. 

<img width="558" height="486" alt="Screenshot 2025-07-18 at 15 37 05" src="https://github.com/user-attachments/assets/dc562f81-989e-4760-839c-70fbb0fef768" />

Then, it will display the answer:

<img width="1000" height="858" alt="image" src="https://github.com/user-attachments/assets/35c21a3f-b6da-4872-b013-770a7c744c92" />

The answer will display the following information. 
- Sentiment: Visual icons (negative, neutral, positive) with one selected to represent the emotional tone or intent of the statement.
- Description: A general definition or explanation of the rhetorical or communicative pattern being identified.
- Statement: A specific instance of the described pattern, identifying the agents involved and the nature of the influence or claim.
- Excerpts: A quoted example from the source material illustrating the identified pattern in context.

### Start analyzing Critical Questions

Once the premises have been stated and the conclusion can be scrutenized for deception, it is possible to analyze the critical questions. In this case, the answers include also the arguments and counter arguments to support the answer of the question.

<img width="1479" height="826" alt="image" src="https://github.com/user-attachments/assets/71d3a25a-a2d6-46a2-85df-a085633fffd8" />

### Export analysis

The tool provide different functionalities in top part of the sidebar:

<img width="529" height="334" alt="Screenshot 2025-07-18 at 17 50 16" src="https://github.com/user-attachments/assets/e69f9a24-f51f-43e5-acdd-93c2091cdf63" />

- Generate Report: It allows to generate a report of the current PDF in HTML style and also a csv file with the content of the analisys of all the PDFs.
- Delete All Annotations: Deletes all the annotations of the current PDF.
- Configuration: It gathers the link for the documentation and the LLM configuration.

HTML report:
<img width="1084" height="928" alt="image" src="https://github.com/user-attachments/assets/6b6134fb-677f-4ba5-8459-2225b65dab00" />

CSV document for three documents:
<img width="844" height="289" alt="image" src="https://github.com/user-attachments/assets/f0a0d166-ca64-4629-bb0a-9df4496e8c48" />


# DEVELOPER MANUAL
https://deepwiki.com/onekin/DeceptionAnalyser/2.2-llm-integration-system





