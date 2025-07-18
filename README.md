# DeceptionAnalyser
DeceptionAnalyser is a web browser extension that represents a novel solution that leverages large language models to detect markers of deception in PDF documents. It is based on argument schemas made up of premises and critical questions. Premises are a logical framework aimed to conclude whether there is deception. After that, if the premise analysis indicates potential deception, critical questions (CQ) function as diagnostic tools. Large Language Models (LLMs) support this process by making a first assessment and providing pieces of evidence from the documents that support their assessment. For CQs, it instantiates the questions proposed in the argument schema for the target document and answers them providing also pieces of evidence and arguments and counter-arguments.

## Schema-Driven Analysis Framework
The foundation of DeceptionAnalyser's analytical approach lies in its flexible argument schema system. Schema selection influences what the LLM evaluates, guiding it to focus on different aspects of potential deception based on the specific context and requirements of the analysis.
The tool offers a dual approach to schema selection. User-created schemas enable domain-specific customization, allowing analysts to tailor the evaluation framework. Conversely, author-proposed schemas offer methodological reliability and serve as benchmarks for consistent analysis. This schema-driven systematization creates analytical frameworks by defining specific premises to evaluate along with corresponding critical questions that probe deeper when deception markers are deteted. 

# END-USERS MANUAL
DeceptionAnalyser supports LLM assisted deception analysis using argument schemas and conducted in a two-stage approach (premises followed by critical questions). After the analysis the tool includes HTML report generation and a Comma-Separated values (CSV) export with all the analysis performed over a set of documents for comparative analysis.

## Installation and Setup
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

<img src="https://github.com/user-attachments/assets/3f95aedd-50cc-4f71-b14c-6303a309b4d6" alt="Screenshot 2022-09-05 at 16 23 23" width="50%">

