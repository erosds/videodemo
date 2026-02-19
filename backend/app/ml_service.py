import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import AdaBoostClassifier, GradientBoostingClassifier, RandomForestClassifier
from sklearn.tree import DecisionTreeClassifier
from sklearn.linear_model import SGDClassifier
from sklearn.neighbors import KNeighborsClassifier
from sklearn.naive_bayes import GaussianNB
from sklearn.svm import SVC
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, confusion_matrix, r2_score, roc_auc_score
from sklearn.inspection import permutation_importance
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
            "Decision Tree": DecisionTreeClassifier,
            "SGD": SGDClassifier,
            "KNN": KNeighborsClassifier,
            "Naive Bayes": GaussianNB,
            "SVM": SVC
        }
        
        self.trained_models = {}
        self.datasets_cache = {}
    
    def _detect_task_type(self, y):
        """
        Rileva automaticamente se è classificazione o regressione
        Returns: 'classification' or 'regression'
        """
        if y.dtype == 'object' or isinstance(y[0], str):
            return 'classification'
        
        unique_values = len(np.unique(y))
        total_values = len(y)
        
        if unique_values / total_values < 0.05:
            return 'classification'
        
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
        try:
            df = pd.read_csv(filepath)
        except UnicodeDecodeError:
            df = pd.read_csv(filepath, encoding='latin-1')
        
        # Assume che l'ultima colonna sia il target
        target_col = df.columns[-1]
        all_feature_cols = df.columns[:-1].tolist()

        # Separa colonne numeriche (bool incluso) da non-numeriche
        numeric_features = [c for c in all_feature_cols if pd.api.types.is_numeric_dtype(df[c]) or pd.api.types.is_bool_dtype(df[c])]
        non_numeric_features = [c for c in all_feature_cols if c not in numeric_features]
        feature_cols = numeric_features
        
        # Rileva task type
        task_type = self._detect_task_type(df[target_col].values)
        
        # Calcola distribuzione delle classi (solo per classificazione)
        if task_type == 'classification':
            class_dist = df[target_col].value_counts().to_dict()
            n_classes = len(class_dist)
            class_type = "binary" if n_classes == 2 else "multiclass"
            # Rileva se le classi sono numeriche o stringhe
            unique_vals = df[target_col].unique()
            classes_dtype = "numeric" if np.issubdtype(df[target_col].dtype, np.number) else "categorical"
        else:
            class_dist = {}
            n_classes = None
            class_type = None
            classes_dtype = None
        
        # Conta righe con almeno un NaN o stringa vuota
        nan_mask = df.isna()
        empty_str_mask = df.apply(lambda col: col.map(lambda x: isinstance(x, str) and x.strip() == ""))
        rows_with_nan = int((nan_mask | empty_str_mask).any(axis=1).sum())
        
        # Preview: prime 5 righe come lista di dict
        preview_df = df.head(5)
        preview = []
        for _, row in preview_df.iterrows():
            row_dict = {}
            for col in df.columns:
                val = row[col]
                if pd.isna(val):
                    row_dict[col] = None
                else:
                    row_dict[col] = val if not isinstance(val, (np.integer, np.floating)) else val.item()
            preview.append(row_dict)
        
        info = {
            "filename": filename,
            "rows": len(df),
            "columns": len(df.columns),
            "features": feature_cols,
            "non_numeric_features": non_numeric_features,
            "target": target_col,
            "task_type": task_type,
            "n_classes": n_classes,
            "class_type": class_type,
            "classes_dtype": classes_dtype,
            "class_distribution": {str(k): int(v) for k, v in class_dist.items()},
            "rows_with_nan": rows_with_nan,
            "preview": preview,
        }
        
        self.datasets_cache[filename] = {
            "info": info,
            "data": df
        }
        
        return info
    
    def prepare_data(self, filename: str, test_size: float, random_state: int, selected_features: list = None):
        """Prepara i dati per training e test"""
        if filename not in self.datasets_cache:
            self.load_dataset(filename)

        df = self.datasets_cache[filename]["data"].copy()
        target_col = df.columns[-1]
        task_type = self.datasets_cache[filename]["info"]["task_type"]
        numeric_features = self.datasets_cache[filename]["info"]["features"]

        if selected_features:
            # Filtra solo le colonne numeriche tra quelle selezionate
            cols = [c for c in selected_features if c in numeric_features]
        else:
            cols = numeric_features

        # Rimuovi righe con NaN nelle colonne usate
        subset = df[cols + [target_col]].dropna()
        X = subset[cols].values
        y = subset[target_col].values

        stratify = y if task_type == 'classification' else None

        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=test_size, random_state=random_state, stratify=stratify
        )

        return X_train, X_test, y_train, y_test
    
    def train_model(self, dataset: str, model_name: str, X_train, y_train, X_test, y_test, selected_features=None):
        """Allena un singolo modello"""
        start_time = time.time()
        
        task_type = self.datasets_cache[dataset]["info"]["task_type"]
        
        ModelClass = self.model_classes[model_name]
        
        params = {
            "AdaBoost": {"n_estimators": 100, "learning_rate": 1.0, "random_state": 42},
            "Gradient Boosting": {"n_estimators": 100, "learning_rate": 0.1, "max_depth": 3, "random_state": 42},
            "Random Forest": {"n_estimators": 100, "random_state": 42, "n_jobs": -1},
            "Decision Tree": {"random_state": 42},
            "SGD": {"loss": "hinge", "max_iter": 1000, "random_state": 42},
            "KNN": {"n_neighbors": 5},
            "Naive Bayes": {},
            "SVM": {"probability": True, "random_state": 42}
        }
        
        model = ModelClass(**params[model_name])
        model.fit(X_train, y_train)
        
        training_time = time.time() - start_time
        
        y_pred = model.predict(X_test)
        y_train_pred = model.predict(X_train)
        
        metrics = {
            "accuracy": float(accuracy_score(y_test, y_pred)),
            "precision": float(precision_score(y_test, y_pred, average='weighted', zero_division=0)),
            "recall": float(recall_score(y_test, y_pred, average='weighted', zero_division=0)),
            "f1_score": float(f1_score(y_test, y_pred, average='weighted', zero_division=0)),
        }
        
        if task_type == 'regression':
            metrics["r2_score"] = float(r2_score(y_test, y_pred))
            metrics["train_r2"] = float(r2_score(y_train, y_train_pred))
        else:
            metrics["r2_score"] = None
            metrics["train_r2"] = None
        
        # AUC-ROC (solo per classificazione)
        if task_type != 'regression':
            try:
                if hasattr(model, 'predict_proba'):
                    y_proba = model.predict_proba(X_test)
                    if y_proba.shape[1] == 2:
                        metrics["auc_roc"] = float(roc_auc_score(y_test, y_proba[:, 1]))
                    else:
                        metrics["auc_roc"] = float(roc_auc_score(y_test, y_proba, multi_class='ovr', average='weighted'))
                else:
                    metrics["auc_roc"] = None
            except Exception:
                metrics["auc_roc"] = None
        else:
            metrics["auc_roc"] = None

        metrics["train_accuracy"] = float(accuracy_score(y_train, y_train_pred))
        metrics["overfit_gap"] = metrics["train_accuracy"] - metrics["accuracy"]
        metrics["training_time_seconds"] = round(training_time, 3)
        metrics["n_train_samples"] = len(y_train)
        metrics["n_test_samples"] = len(y_test)
        
        model_key = f"{dataset}_{model_name.replace(' ', '_')}"
        model_path = self.models_dir / f"{model_key}.joblib"
        joblib.dump(model, model_path)
        
        from datetime import datetime
        all_features = self.datasets_cache[dataset]["info"]["features"]
        used_features = selected_features if selected_features else all_features

        metadata = {
            "dataset": dataset,
            "model_name": model_name,
            "task_type": task_type,
            "metrics": metrics,
            "feature_count": X_train.shape[1],
            "selected_features": used_features,
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
        
        task_type = self.trained_models[model_key]["metadata"]["task_type"]
        selected_features = self.trained_models[model_key]["metadata"].get("selected_features")

        X_train, X_test, y_train, y_test = self.prepare_data(dataset, 0.2, 42, selected_features)
        
        model = self.trained_models[model_key]["model"]
        y_pred = model.predict(X_test)
        
        results = []
        for i in range(len(y_test)):
            result_dict = {
                "sample_id": i,
                "true_value": str(y_test[i]),
                "predicted_value": str(y_pred[i]),
            }
            
            if task_type == 'classification':
                result_dict["correct"] = bool(y_test[i] == y_pred[i])
                result_dict["error"] = None
            else:
                result_dict["correct"] = None
                result_dict["error"] = float(abs(y_test[i] - y_pred[i]))
            
            results.append(result_dict)
        
        metrics = {
            "accuracy": float(accuracy_score(y_test, y_pred)),
            "precision": float(precision_score(y_test, y_pred, average='weighted', zero_division=0)),
            "recall": float(recall_score(y_test, y_pred, average='weighted', zero_division=0)),
            "f1_score": float(f1_score(y_test, y_pred, average='weighted', zero_division=0)),
            "confusion_matrix": confusion_matrix(y_test, y_pred).tolist()
        }
        
        if task_type == 'regression':
            metrics["r2_score"] = float(r2_score(y_test, y_pred))
        else:
            metrics["r2_score"] = None
        
        return results, metrics
    
    def get_feature_importance(self, dataset: str, model_name: str):
        """Estrae feature importance da un modello trainato"""
        model_key = f"{dataset}_{model_name.replace(' ', '_')}"

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

        model = self.trained_models[model_key]["model"]

        if hasattr(model, 'feature_importances_'):
            importances = model.feature_importances_
        elif hasattr(model, 'coef_'):
            # SGD, SVM lineare — usa valore assoluto dei coefficienti
            coefs = np.abs(model.coef_)
            if coefs.ndim > 1:
                coefs = coefs.mean(axis=0)
            importances = coefs / coefs.sum() if coefs.sum() > 0 else coefs
        else:
            # KNN, Naive Bayes — usa permutation importance
            selected_features = self.trained_models[model_key]["metadata"].get("selected_features")
            X_train, X_test, y_train, y_test = self.prepare_data(
                dataset, 0.2, 42, selected_features
            )
            # Subsampla il test set per velocizzare (max 200 campioni)
            if len(X_test) > 200:
                idx = np.random.RandomState(42).choice(len(X_test), 200, replace=False)
                X_eval, y_eval = X_test[idx], y_test[idx]
            else:
                X_eval, y_eval = X_test, y_test
            result = permutation_importance(model, X_eval, y_eval, n_repeats=5, random_state=42)
            importances = result.importances_mean
            # Normalizza sui valori assoluti (evita il caso tutto-zero da negativi)
            importances = np.abs(importances)
            total = importances.sum()
            if total > 0:
                importances = importances / total

        # Recupera nomi feature da metadata (rispetta selezione colonne) o dal dataset cache
        feature_names = self.trained_models[model_key]["metadata"].get("selected_features")
        if not feature_names:
            if dataset not in self.datasets_cache:
                self.load_dataset(dataset)
            feature_names = self.datasets_cache[dataset]["info"]["features"]

        # Crea lista ordinata per importanza decrescente
        feature_importance_list = [
            {"feature": name, "importance": float(imp)}
            for name, imp in zip(feature_names, importances)
        ]
        feature_importance_list.sort(key=lambda x: x["importance"], reverse=True)

        return feature_importance_list

    def get_trained_models(self, dataset: str):
        """Ottieni lista di modelli trainati per un dataset"""
        trained = []
        for file in self.models_dir.glob(f"{dataset}_*_metadata.json"):
            with open(file, 'r') as f:
                metadata = json.load(f)
                trained.append(metadata)
        return trained