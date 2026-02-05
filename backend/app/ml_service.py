import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import AdaBoostClassifier, GradientBoostingClassifier, RandomForestClassifier
from sklearn.tree import DecisionTreeClassifier
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, confusion_matrix, r2_score
import joblib
import os
from pathlib import Path
import json
import time

class MLService:
    def __init__(self):
        self.datasets_dir = Path("datasets")
        self.models_dir = Path("trained_models")
        self.models_dir.mkdir(exist_ok=True)
        
        self.model_classes = {
            "AdaBoost": AdaBoostClassifier,
            "Gradient Boosting": GradientBoostingClassifier,
            "Random Forest": RandomForestClassifier,
            "Decision Tree": DecisionTreeClassifier
        }
        
        self.trained_models = {}
        self.datasets_cache = {}
    
    def _detect_task_type(self, y):
        """
        Rileva automaticamente se è classificazione o regressione
        Returns: 'classification' or 'regression'
        """
        # Se y contiene stringhe o oggetti → classificazione
        if y.dtype == 'object' or isinstance(y[0], str):
            return 'classification'
        
        # Se y è numerico
        unique_values = len(np.unique(y))
        total_values = len(y)
        
        # Se ci sono pochi valori unici rispetto al totale → classificazione
        # Euristica: se unique/total < 0.05 → probabilmente classificazione
        if unique_values / total_values < 0.05:
            return 'classification'
        
        # Altrimenti → regressione
        return 'regression'
        
    def list_datasets(self):
        """Lista tutti i dataset CSV nella cartella datasets"""
        datasets = []
        for file in self.datasets_dir.glob("*.csv"):
            datasets.append(file.name)
        return datasets
    
    def load_dataset(self, filename: str):
        """Carica e analizza un dataset"""
        if filename in self.datasets_cache:
            return self.datasets_cache[filename]["info"]
            
        filepath = self.datasets_dir / filename
        df = pd.read_csv(filepath)
        
        # Assume che l'ultima colonna sia il target
        target_col = df.columns[-1]
        feature_cols = df.columns[:-1].tolist()
        
        # Rileva task type
        task_type = self._detect_task_type(df[target_col].values)
        
        # Calcola distribuzione delle classi (solo per classificazione)
        if task_type == 'classification':
            class_dist = df[target_col].value_counts().to_dict()
            n_classes = len(class_dist)
        else:
            class_dist = {}
            n_classes = None
        
        info = {
            "filename": filename,
            "rows": len(df),
            "columns": len(df.columns),
            "features": feature_cols,
            "target": target_col,
            "task_type": task_type,
            "n_classes": n_classes,
            "class_distribution": {str(k): int(v) for k, v in class_dist.items()}
        }
        
        self.datasets_cache[filename] = {
            "info": info,
            "data": df
        }
        
        return info
    
    def prepare_data(self, filename: str, test_size: float, random_state: int):
        """Prepara i dati per training e test"""
        if filename not in self.datasets_cache:
            self.load_dataset(filename)
        
        df = self.datasets_cache[filename]["data"]
        target_col = df.columns[-1]
        task_type = self.datasets_cache[filename]["info"]["task_type"]
        
        X = df.iloc[:, :-1].values
        y = df[target_col].values
        
        # Per classificazione, usa stratify
        stratify = y if task_type == 'classification' else None
        
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=test_size, random_state=random_state, stratify=stratify
        )
        
        return X_train, X_test, y_train, y_test
    
    def train_model(self, dataset: str, model_name: str, X_train, y_train, X_test, y_test):
        """Allena un singolo modello"""
        start_time = time.time()
        
        # Rileva task type
        task_type = self.datasets_cache[dataset]["info"]["task_type"]
        
        ModelClass = self.model_classes[model_name]
        
        # Parametri ottimizzati per ciascun modello
        params = {
            "AdaBoost": {"n_estimators": 100, "learning_rate": 1.0, "random_state": 42},
            "Gradient Boosting": {"n_estimators": 100, "learning_rate": 0.1, "max_depth": 3, "random_state": 42},
            "Random Forest": {"n_estimators": 100, "random_state": 42, "n_jobs": -1},
            "Decision Tree": {"random_state": 42}
        }
        
        model = ModelClass(**params[model_name])
        model.fit(X_train, y_train)
        
        training_time = time.time() - start_time
        
        # Predizioni
        y_pred = model.predict(X_test)
        y_train_pred = model.predict(X_train)
        
        # Metriche comuni
        metrics = {
            "accuracy": float(accuracy_score(y_test, y_pred)),
            "precision": float(precision_score(y_test, y_pred, average='weighted', zero_division=0)),
            "recall": float(recall_score(y_test, y_pred, average='weighted', zero_division=0)),
            "f1_score": float(f1_score(y_test, y_pred, average='weighted', zero_division=0)),
        }
        
        # Aggiungi R² SOLO per regressione
        if task_type == 'regression':
            metrics["r2_score"] = float(r2_score(y_test, y_pred))
            metrics["train_r2"] = float(r2_score(y_train, y_train_pred))
        else:
            # Per classificazione, R² non ha senso, lascia None o ometti
            metrics["r2_score"] = None
            metrics["train_r2"] = None
        
        # Metriche di training
        metrics["train_accuracy"] = float(accuracy_score(y_train, y_train_pred))
        metrics["overfit_gap"] = metrics["train_accuracy"] - metrics["accuracy"]
        metrics["training_time_seconds"] = round(training_time, 3)
        metrics["n_train_samples"] = len(y_train)
        metrics["n_test_samples"] = len(y_test)
        
        # Salva il modello
        model_key = f"{dataset}_{model_name.replace(' ', '_')}"
        model_path = self.models_dir / f"{model_key}.joblib"
        joblib.dump(model, model_path)
        
        # Salva anche i metadati
        from datetime import datetime
        metadata = {
            "dataset": dataset,
            "model_name": model_name,
            "task_type": task_type,
            "metrics": metrics,
            "feature_count": X_train.shape[1],
            "trained_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "parameters": params[model_name]
        }
        
        metadata_path = self.models_dir / f"{model_key}_metadata.json"
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=2)
        
        self.trained_models[model_key] = {
            "model": model,
            "metadata": metadata
        }
        
        return metrics
    
    def predict(self, dataset: str, model_name: str):
        """Usa un modello trainato per fare predizioni sul test set"""
        model_key = f"{dataset}_{model_name.replace(' ', '_')}"
        
        # Carica il modello se non in cache
        if model_key not in self.trained_models:
            model_path = self.models_dir / f"{model_key}.joblib"
            if not model_path.exists():
                raise ValueError(f"Model {model_key} not found. Train it first.")
            
            model = joblib.load(model_path)
            
            metadata_path = self.models_dir / f"{model_key}_metadata.json"
            with open(metadata_path, 'r') as f:
                metadata = json.load(f)
            
            self.trained_models[model_key] = {
                "model": model,
                "metadata": metadata
            }
        
        # Ottieni task type
        task_type = self.trained_models[model_key]["metadata"]["task_type"]
        
        # Prepara i dati (usa stesso random_state per consistenza)
        X_train, X_test, y_train, y_test = self.prepare_data(dataset, 0.2, 42)
        
        model = self.trained_models[model_key]["model"]
        y_pred = model.predict(X_test)
        
        # Crea risultati dettagliati
        results = []
        for i in range(len(y_test)):
            result_dict = {
                "sample_id": i,
                "true_value": str(y_test[i]),
                "predicted_value": str(y_pred[i]),
            }
            
            # Per classificazione: correct boolean
            if task_type == 'classification':
                result_dict["correct"] = bool(y_test[i] == y_pred[i])
                result_dict["error"] = None
            else:
                # Per regressione: errore numerico
                result_dict["correct"] = None
                result_dict["error"] = float(abs(y_test[i] - y_pred[i]))
            
            results.append(result_dict)
        
        # Calcola metriche
        metrics = {
            "accuracy": float(accuracy_score(y_test, y_pred)),
            "precision": float(precision_score(y_test, y_pred, average='weighted', zero_division=0)),
            "recall": float(recall_score(y_test, y_pred, average='weighted', zero_division=0)),
            "f1_score": float(f1_score(y_test, y_pred, average='weighted', zero_division=0)),
            "confusion_matrix": confusion_matrix(y_test, y_pred).tolist()
        }
        
        # Aggiungi R² solo per regressione
        if task_type == 'regression':
            metrics["r2_score"] = float(r2_score(y_test, y_pred))
        else:
            metrics["r2_score"] = None
        
        return results, metrics
    
    def get_trained_models(self, dataset: str):
        """Ottieni lista di modelli trainati per un dataset"""
        trained = []
        for file in self.models_dir.glob(f"{dataset}_*_metadata.json"):
            with open(file, 'r') as f:
                metadata = json.load(f)
                trained.append(metadata)
        return trained